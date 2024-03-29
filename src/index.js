/* global WebSocket */
import EventEmitter from 'events'
import Delta from './ot/delta.js'
import DeltaString from './ot/string.js'
import OpIterator from './ot/op-iterator.js'
import { SUBTYPES, setSubtypes, BASE_TYPES } from './ot/subtypes.js'
import { clone } from './ot/utils'
import APIError from './api-error'

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
			pingInterval: 10000,
			callTimeout: 10000,
			joinTimeout: 60000,
			reconnectDelay: 1000,
			sendSelectInterval: 600,
			token: ''
		}
		this._config = Object.assign(defaultConfig, config)
		this._url = url
		this._otChannels = {} // keyed by channel name: {deltaInFlight, buffer, rev}
		this._currentView = null
		this._createSocket()
	}

	close () {
		this._normalClose = true
		this._socket.close()
		clearTimeout(this._joinTimeout)
		clearTimeout(this._authenticationTimeout)
		clearTimeout(this._sendSelectTimeout)
		this._sendSelectTimeout = null
	}

	call (name, data, opts) {
		const options = {
			timeout: this._config.callTimeout
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
				this._timeoutedRequests[id] = true
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

		const handleAck = function ({ rev }, deferred) {
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
			deferred.resolve()
		}

		const sendDelta = (deltaToSend) => {
			const { id, promise } = this._createRequest(handleAck)
			channel.deltaInFlight = deltaToSend
			const payload = ['ot:delta', id, channelName, {
				delta: deltaToSend.ops,
				rev: channel.rev
			}]
			this._send(JSON.stringify(payload))

			return promise
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

	sendSelect (reference, data) {
		const payload = ['user:select', reference]
		if (data) payload.push(data)
		if (!this._sendSelectTimeout) {
			this._send(JSON.stringify(payload))
			this._sendSelectPayload = null
			this._sendSelectTimeout = setTimeout(() => {
				this._sendSelectTimeout = null
				if (this._sendSelectPayload) this._send(JSON.stringify(this._sendSelectPayload))
				this._sendSelectPayload = null
			}, this._config.sendSelectInterval)
		} else {
			this._sendSelectPayload = payload
		}
	}

	sendView (reference) {
		const payload = JSON.stringify(['user:view', reference])
		if (payload === this._currentView) return
		if (this.socketState === 'open') this._send(payload)
		this._currentView = payload
	}

	closeChannels (prefix) {
		for (const channelName of Object.keys(this._otChannels)) {
			if (channelName.startsWith(prefix)) this._closeChannel(channelName)
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
			this._authenticationTimeout = setTimeout(() => {
				this._handlePingTimeout()
			}, this._config.pingInterval)
		})

		this._socket.addEventListener('close', (event) => {
			this.socketState = 'closed'
			for (const channelName of Object.keys(this._otChannels)) {
				this._closeChannel(channelName)
			}
			this.emit('closed', event) // why past tense? because the socket is already closed and not currently closing
			if (!this._normalClose) {
				setTimeout(() => {
					this.emit('reconnecting')
					this._createSocket()
				}, this._config.reconnectDelay) // throttle reconnect
			}
		})
		this._socket.addEventListener('message', this._processMessage.bind(this))
		this._openRequests = {} // save deferred promises from requests waiting for reponse
		this._timeoutedRequests = {} // save timed out request ids so we can drop responses
		this._nextRequestIndex = 1 // autoincremented rohrpost message id
		this._authenticationTimeout = null
		this._joinTimeout = null
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
		if (this._socket.readyState !== 1) return
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
	}

	_processMessage (rawMessage) {
		const message = JSON.parse(rawMessage.data)

		const actionHandlers = {
			error: this._handleError.bind(this),
			success: this._handleCallSuccess.bind(this),
			pong: this._handlePong.bind(this),
			authenticated: this._handleAuthenticated.bind(this),
			joined: this._handleJoined.bind(this),
			join: this._handleJoinError.bind(this),
			'ot:delta': this._handleOtDelta.bind(this)
		}
		if (actionHandlers[message[0]] === undefined) {
			this.emit('message', message)
		} else {
			// drop message if request has already timed out client-side
			if (this._timeoutedRequests[message[1]]) {
				delete this._timeoutedRequests[message[1]]
			} else {
				actionHandlers[message[0]](message)
			}
		}
		this.emit('log', {
			direction: 'receive',
			data: rawMessage.data
		})
	}

	// request - response promise matching
	_createRequest (callback) {
		const id = this._nextRequestIndex++
		const deferred = defer()
		this._openRequests[id] = { deferred, callback }
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
			req.deferred.reject(new APIError(message[2]))
		}
	}

	_handleCallSuccess (message) {
		const req = this._popPendingRequest(message[1])
		if (req === null || req === undefined) {
			this.emit('warning', `no saved request with id: ${message[1]}`)
		} else {
			if (req.callback) {
				req.callback(message[2], req.deferred)
			} else {
				req.deferred.resolve(message[2])
			}
		}
	}

	_handlePong (message) {
		this.emit('pong')
		this._pingState.latestPong = Date.now()
	}

	_handleAuthenticated () {
		clearTimeout(this._authenticationTimeout)
		this._authenticationTimeout = null
		this._joinTimeout = setTimeout(() => {
			this._handlePingTimeout()
		}, this._config.joinTimeout)
	}

	_handleJoined (message) {
		clearTimeout(this._joinTimeout)
		this._joinTimeout = null
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
		const viewToResend = this._currentView
		this._currentView = null
		this.emit('joined', message[1])
		// if _currentView is set again, sendView() was called from `joined` handler. Discard.
		if (viewToResend && !this._currentView) this._send(viewToResend)
		// start pinging
		const socket = this._socket
		setTimeout(() => {
			if (socket === this._socket) this._ping(socket)
		}, this._config.pingInterval)
	}

	_handleJoinError (message) {
		clearTimeout(this._joinTimeout)
		this._joinTimeout = null
		this.emit('error', message[1].error)
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
			const reveicedDelta = delta
			delta = channel.buffer.delta.transform(delta)
			channel.buffer.delta = reveicedDelta.transform(channel.buffer.delta, true)
		}

		return this.emit('ot:delta', channelName, delta)
	}
}

export { Delta, DeltaString, QuidditchClient, OpIterator, SUBTYPES, setSubtypes, BASE_TYPES, clone as cloneOps, APIError }
