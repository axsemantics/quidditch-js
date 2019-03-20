/* global WebSocket */
import EventEmitter from 'events'
import Delta from './ot/delta.js'
import DeltaString from './ot/string.js'
import OpIterator from './ot/op-iterator.js'
import { SUBTYPES, setSubtypes, BASE_TYPES } from './ot/subtypes.js'

const defer = function () {
	const deferred = {}
	deferred.promise = new Promise(function (resolve, reject) {
		deferred.resolve = resolve
		deferred.reject = reject
	})
	return deferred
}

class QuidditchClient extends EventEmitter {
	constructor (url, config) {
		super()
		const defaultConfig = {
			pingInterval: 5000,
			token: ''
		}
		this._config = Object.assign(defaultConfig, config)
		this._url = url
		this._otChannels = {} // keyed by channel name: {deltaInFlight, buffer, rev}
		this._createSocket()
	}

	close () {
		this._normalClose = true
		this._socket.close()
	}

	call (name, data, opts) {
		const options = {
			timeout: 2000
		}
		Object.assign(options, opts)

		const { id, promise } = this._createRequest()
		const payload = [
			name,
			id,
			data
		]
		this._send(JSON.stringify(payload))
		setTimeout(() => {
			if (this._openRequests[id]) {
				const timeoutedRequest = this._popPendingRequest(id)
				timeoutedRequest.deferred.reject(new Error('call timed out'))
			}
		}, options.timeout)
		return promise
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

		const handleAck = function ({ rev }) {
			channel.deltaInFlight = null
			channel.rev = rev

			if (channel.buffer) {
				const buffer = channel.buffer
				channel.buffer = null
				sendDelta(buffer.delta).then(() => {
					for (const promise of buffer.promises) {
						promise.resolve()
					}
				}).catch((error) => {
					for (const promise of buffer.promises) {
						promise.reject(error)
					}
				})
			}
			return Promise.resolve()
		}

		const sendDelta = (deltaToSend) => {
			const { id, promise } = this._createRequest()
			channel.deltaInFlight = deltaToSend
			const payload = ['ot:delta', id, channelName, {
				delta: deltaToSend.ops,
				rev: channel.rev
			}]
			this._send(JSON.stringify(payload))

			return promise.then(handleAck)
		}

		if (!channel.deltaInFlight) {
			return sendDelta(delta)
		} else {
			const deferred = defer()
			if (channel.buffer) {
				channel.buffer.delta = channel.buffer.delta.compose(delta)
				channel.buffer.promises.push(deferred)
			} else {
				channel.buffer = {
					delta,
					promises: [deferred]
				}
			}
			return deferred.promise
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
		})

		this._socket.addEventListener('close', (event) => {
			this.socketState = 'closed'
			for (const channelName of Object.keys(this._otChannels)) {
				this._closeChannel(channelName)
			}
			this.emit('closed') // why past tense? because the socket is already closed and not currently closing
			if (!this._normalClose) {
				setTimeout(() => {
					this.emit('reconnecting')
					this._createSocket()
				}, this._config.reconnectDelay) // throttle reconnect
			}
		})
		this._socket.addEventListener('message', this._processMessage.bind(this))
		this._openRequests = {} // save deferred promises from requests waiting for reponse
		this._nextRequestIndex = 1 // autoincremented rohrpost message id
	}

	_send (payload) {
		this._socket.send(payload)
		this.emit('log', {
			direction: 'send',
			data: payload
		})
	}

	_authenticate () {
		const payload = [
			'auth',
			{ token: this._config.token }
		]
		this._send(JSON.stringify(payload))
	}

	_ping (starterSocket) { // we need a ref to the socket to detect reconnects and stop the old ping loop
		const timestamp = Date.now()
		const payload = [
			'ping',
			timestamp
		]
		this._send(JSON.stringify(payload))
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
			error: this._handleError.bind(this),
			success: this._handleCallSuccess.bind(this),
			pong: this._handlePong.bind(this),
			joined: this._handleJoined.bind(this),
			'ot:delta': this._handleOtDelta.bind(this)
		}
		if (actionHandlers[message[0]] === undefined) {
			this.emit('message', message)
		} else {
			actionHandlers[message[0]](message)
		}
		this.emit('log', {
			direction: 'receive',
			data: rawMessage.data
		})
	}

	// request - response promise matching
	_createRequest (args) {
		const id = this._nextRequestIndex++
		const deferred = defer()
		this._openRequests[id] = { deferred, args }
		return { id, promise: deferred.promise }
	}

	_closeChannel (channelName) {
		const channel = this._otChannels[channelName]
		delete this._otChannels[channelName]
		if (channel.buffer && channel.buffer.promises) {
			for (const promise of channel.buffer.promises) {
				promise.reject('closed')
			}
		}
	}

	_popPendingRequest (id) {
		const req = this._openRequests[id]
		this._openRequests[id] = undefined
		return req
	}

	_handleError (message) {
		const req = this._popPendingRequest(message[1])
		if (req === null || req === undefined) {
			this.emit('error', message[message.length - 1])
		} else {
			req.deferred.reject(message[2])
		}
	}

	_handleCallSuccess (message) {
		const req = this._popPendingRequest(message[1])
		if (req === null || req === undefined) {
			this.emit('error', `no saved request with id: ${message.id}`)
		} else {
			req.deferred.resolve(message[2])
		}
	}

	_handlePong (message) {
		this.emit('pong')
		this._pingState.latestPong = Date.now()
	}

	_handleJoined (message) {
		if (message[1].channels) { // initialize channel revision
			const newChannels = Object.keys(message[1].channels)
			const closedChannels = Object.keys(this._otChannels).filter((key) => !newChannels.includes(key))
			for (const channelName of newChannels) {
				this._otChannels[channelName] = {
					deltaInFlight: null,
					buffer: null,
					rev: message[1].channels[channelName].last_revision
				}
			}
			for (const channelName of closedChannels) {
				this._closeChannel(channelName)
			}
		}
		this.emit('joined', message[1])
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
			delta = channel.buffer.delta.transform(delta)
		}
		return this.emit('ot:delta', channelName, delta)
	}
}

export { Delta, DeltaString, QuidditchClient, OpIterator, SUBTYPES, setSubtypes, BASE_TYPES }
