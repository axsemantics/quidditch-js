/* global WebSocket */
import EventEmitter from 'events'
import Delta from './ot/delta.js'
import OpIterator from './ot/op-iterator.js'

class QuidditchClient extends EventEmitter {
	constructor (url, config) {
		super()
		const defaultConfig = {
			pingInterval: 5000,
			token: ''
		}
		this._config = Object.assign(defaultConfig, config)
		this._url = url
		this._joinedProject = null
		this._otChannels = {} // keyed by channel name: {deltaInFlight, buffer, rev}
		this._createSocket()
	}

	close () {
		this._normalClose = true
		this._socket.close()
	}

	join (projectId) {
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

		const payload = [
			name,
			data
		]
		this._socket.send(JSON.stringify(payload))
	}

	sendDelta (channelName, delta) {
		let channel = this._otChannels[channelName]
		if (!channel) {
			channel = this._otChannels[channelName] = {
				deltaInFlight: null,
				buffer: null,
				rev: 0
			}
		}

		if (!channel.deltaInFlight) {
			channel.deltaInFlight = delta
			const payload = ['ot:delta', channelName, {
				delta: delta.ops,
				rev: channel.rev
			}]
			this._socket.send(JSON.stringify(payload))
		} else {
			channel.buffer = channel.buffer ? channel.buffer.compose(delta) : delta
		}
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

		const actionHandlers = {
			pong: this._handlePong.bind(this),
			authenticated: this._handleAuthenticated.bind(this),
			joined: this._handleJoined.bind(this),
			'ot:ack': this._handleOtAck.bind(this),
			'ot:delta': this._handleOtDelta.bind(this)
		}

		if (actionHandlers[message[0]] === undefined) {
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
		if (message[1].channels) { // initialize channel revision
			for (const channelName of Object.keys(message[1].channels)) {
				this._otChannels[channelName] = {
					deltaInFlight: null,
					buffer: null,
					rev: message[1].channels[channelName].last_revision
				}
			}
		}
		this.emit('joined', message[1])
	}

	_handleOtAck (message) {
		const channelName = message[1]
		const channel = this._otChannels[channelName]
		if (!channel || !channel.deltaInFlight)
			return this.emit('error', new Error('Got ack for unknown ot channel!'))

		channel.deltaInFlight = null
		channel.rev = message[2].rev

		if (channel.buffer) {
			const payload = ['ot:delta', channelName, {
				delta: channel.buffer.ops,
				rev: channel.rev
			}]
			channel.deltaInFlight = channel.buffer
			channel.buffer = null
			this._socket.send(JSON.stringify(payload))
		}

		this.emit('ot:ack', channelName)
	}

	_handleOtDelta (message) {
		const channelName = message[1]
		const data = message[2]
		let delta = new Delta(data.delta)
		let channel = this._otChannels[channelName]
		if (!channel) {
			// somebody else started a channel
			channel = this._otChannels[channelName] = {
				deltaInFlight: null,
				buffer: null,
				rev: 0
			}
		}
		channel.rev = data.rev
		if (channel.deltaInFlight) {
			delta = channel.deltaInFlight.transform(delta)
		}
		if (channel.buffer) {
			delta = channel.buffer.transform(delta)
		}
		return this.emit('ot:delta', channelName, delta)
	}
}

export { Delta, QuidditchClient, OpIterator }
