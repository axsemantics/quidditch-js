/* global WebSocket */
import EventEmitter from 'events'

const defer = function () {
	const deferred = {}
	deferred.promise = new Promise(function (resolve, reject) {
		deferred.resolve = resolve
		deferred.reject = reject
	})
	return deferred
}

export default class QuidditchClient extends EventEmitter {
	constructor (url, config) {
		super()
		const defaultConfig = {
			pingInterval: 5000,
			token: ''
		}
		this._config = Object.assign(defaultConfig, config)
		this._url = url
		this._joinedProject = null
		this._createSocket()
	}

	close () {
		this._normalClose = true
		this._socket.close()
	}

	join (projectId) {
		// const {id, promise} = this._createRequest(group)
		const payload = [
			'join',
			{project: projectId}
		]
		this._socket.send(JSON.stringify(payload))
		// return promise
	}

	call (name, data, opts) {
		const options = {
			timeout: 2000
		}
		Object.assign(options, opts)

		// const {id, promise} = this._createRequest()
		const payload = [
			name,
			// id,
			data
		]
		this._socket.send(JSON.stringify(payload))
		// setTimeout(() => {
		// 	if (this._openRequests[id]) {
		// 		const timeoutedRequest = this._popPendingRequest(id)
		// 		timeoutedRequest.deferred.reject(new Error('call timed out'))
		// 	}
		// }, options.timeout)
		// return promise
	}

	// ===========================================================================
	// INTERNALS
	// ===========================================================================
	_createSocket () {
		this._socket = new WebSocket(this._url)
		this.socketState = 'connecting' // 'closed', 'open', 'connecting'
		this._pingState = {
			latestPong: 0,
		}
		this.normalClose = false
		this._socket.addEventListener('open', () => {
			this.emit('open')
			this.socketState = 'open'
			this._authenticate()
			// start pinging
			this._ping(this._socket)
			// this._resubscribe()
		})

		this._socket.addEventListener('close', (event) => {
			this.socketState = 'closed'
			this.emit('closed') // why past tense? because the socket is already closed and not currently closing
			if (!this._normalClose) {
				setTimeout(() => {
					this.emit('reconnecting')
					this._createSocket()
				}, 3000) // throttle reconnect
			}
		})
		this._socket.addEventListener('message', this._processMessage.bind(this))
		this._openRequests = {} // save deferred promises from requests waiting for reponse
		this._nextRequestIndex = 1 // autoincremented rohrpost message id
	}

	_authenticate () {
		const payload = [
			'auth',
			{token: this._config.token}
		]
		this._socket.send(JSON.stringify(payload))
	}

	_ping (starterSocket) { // we need a ref to the socket to detect reconnects and stop the old ping loop
		const timestamp = Date.now()
		const payload = [
			'ping',
			timestamp
		]
		this._socket.send(JSON.stringify(payload))
		this.emit('ping')
		setTimeout(() => {
			if (this._socket.readyState !== 1 || this._socket !== starterSocket) return // looping on old socket, abort
			if (timestamp > this._pingState.latestPong) // we received no pong after the last ping
				this._handlePingTimeout()
			else this._ping(starterSocket)
		}, this._config.pingInterval)
	}

	_handlePingTimeout () {
		this._socket.close()
		this.emit('closed')
	}

	_processMessage (rawMessage) {
		const message = JSON.parse(rawMessage.data)
		// if (message.error) {
		// 	// this.emit('error', message.error)
		// 	const req = this._popPendingRequest(message.id)
		// 	if (req === null) return
		// 	req.deferred.reject(message.error)
		// 	return
		// }

		const actionHandlers = {
			pong: this._handlePong.bind(this),
			authenticated: this._handleAuthenticated.bind(this),
			joined: this._handleJoined.bind(this)
		}

		if (actionHandlers[message[0]] === undefined) {
			// this._handleGeneric(message)
			this.emit('message', message)
		} else {
			actionHandlers[message[0]](message)
		}
	}

	_handlePong (message) {
		this.emit('pong')
		this._pingState.latestPong = Date.now()
	}

	_handleAuthenticated (message) {
		this.emit('authenticated')
	}

	_handleJoined (message) {
		this.emit('joined', message[1])
	}

	_resubscribe () {
		for (let args of Object.values(this._subscriptions)) {
			this.subscribe(args)
		}
	}

	_handleGeneric (message) {
		const req = this._popPendingRequest(message[1])
		if (req === null) return // error already emitted in pop
		req.deferred.resolve(message[2])
	}

	// request - response promise matching
	_createRequest (args) {
		const id = this._nextRequestIndex++
		const deferred = defer()
		this._openRequests[id] = {deferred, args}
		return {id, promise: deferred.promise}
	}

	_popPendingRequest (id) {
		const req = this._openRequests[id]
		if (!req) {
			this.emit('error', `no saved request with id: ${id}`)
		} else {
			this._openRequests[id] = undefined
			return req
		}
	}
}
