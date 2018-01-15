# quidditch-js [![Build Status](https://travis-ci.org/axsemantics/quidditch-js.svg?branch=master)](https://travis-ci.org/axsemantics/quidditch-js) [![Coverage Status](https://coveralls.io/repos/github/axsemantics/quidditch-js/badge.svg?branch=master)](https://coveralls.io/github/axsemantics/quidditch-js?branch=master) [![npm](https://img.shields.io/npm/v/quidditch.svg)](https://www.npmjs.com/package/quidditch)

A javascript-client for the quidditch collaboration framework.

# Develop / Run tests
```
npm test
```

# Build / Deploy
```
npm run build
npm publish
```

# API
## Getting Started
```js
import { Delta, QuidditchClient } from 'quidditch'

const client = new QuidditchClient('wss://quidditch-server.com/ws', {
  token: 'JWT TOKEN'
})

client.on('open', () => {
  client.join(531)
  client.call('a-simple-call', {payload: 3})
  client.sendDelta('colab-channel-1', new Delta({insert: 'abc'}))
})

client.on('ot:delta', (channel, delta) => {
    // delta.apply to your local text
})
```
