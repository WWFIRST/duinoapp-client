/* eslint-disable no-console, max-classes-per-file */

import Vue from 'vue';
import BaseSerial from './base-serial';

const TRACE = false;
const PORT = 444;
console.log('using websocket-to-serial protocol');

// basic wrapper for WebSocket with async connect and close
// only parts required for the protocol are implemented
class WebSocketAsync {
  constructor(url, protocols = undefined) {
    this._url = url;
    this._protocols = protocols;
    this._socket = null;

    this.onmessage = null;
    this.onclose = null;
  }

  get connected() {
    return this._socket && this._socket.readyState === WebSocket.OPEN;
  }

  send(data) {
    if (this._socket) {
      this._socket.send(data);
    }
  }

  async close(code = undefined, reason = undefined) {
    if (this._socket) {
      const socket = this._socket;
      this._socket = null;

      // websocket is closing asynchronously, we need to wait
      // for the corresponding onclose to fire, so we attach
      // another listener here and promisify
      return new Promise((resolve) => {
        socket.addEventListener('close', () => {
          resolve();
        });
        socket.close(code, reason);
      });
    }

    return Promise.resolve();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(this._url, this._protocols);
      socket.binaryType = 'arraybuffer';

      this._socket = socket;

      socket.addEventListener('message', this.onmessage);
      socket.addEventListener('close', this.onclose);

      socket.onopen = () => {
        resolve();
      };

      socket.onerror = (event) => {
        reject(event);
      };
    });
  }
}

class WebSocketSerial extends BaseSerial {
  constructor() {
    super();
    this.requestRequired = true; // instructs UI to invoke requestDevice
    this.devices = JSON.parse(localStorage.deviceNames || '[]');
    this._sockets = {};
    this._currentSocket = null; // WebSocket
    this._beforeWriteFn = null;
    this._writeLock = false;
    this.implementation = 'websocket';
  }

  _getSocket(url) {
    let socket = this._sockets[url];
    if (!socket) {
      try {
        socket = new WebSocketAsync(`wss://${url}:${PORT}`);

        socket.onmessage = async (ev) => {
          if (ev.data instanceof ArrayBuffer) {
            const data = Buffer.from(ev.data);
            if (TRACE) {
              console.log('websocket-to-serial: recv binary hex', data.toString('hex'));
            }
            this.emit('data', data);
            if (!this.mute) {
              this.emit('message', data.toString(this.encoding));
            }
          } else if (typeof ev.data === 'string') {
            console.log('websocket-to-serial: recv string', ev.data);
            if (!this.mute) {
              this.emit('message', ev.data);
            }
          } else {
            console.log('websocket-to-serial: recv unknown (dropped)', ev.data);
          }
        };

        socket.onclose = (ev) => {
          const debug = `code = ${ev.code}, reason = ${ev.reason}, clean = ${ev.wasClean}`;
          console.log(`websocket-to-serial: termination observed | ${debug}`);

          if (this._currentSocket === socket) {
            this.connected = false;
            this.emit('disconnect', this.currentDevice);
            console.log('websocket-to-serial: disconnected');
          }
        };
      } catch (err) {
        console.log('websocket-to-serial: error', err);
        this.emit('errorPrompt', err.message);
        return null;
      }
      this._sockets[url] = socket;
    }
    return socket;
  }

  async requestDevice() {
    // the argument (value) here is arbitrary and is passed through into setDeviceName
    this.emit('deviceNamePrompt', 'new');
  }

  async setDeviceName(value, name) {
    // value here equals to 'new' from above and is ignored

    // validates that name is a proper URL and WebSocket can be created
    if (!this._getSocket(name)) {
      return;
    }

    // do not add multiple devices with the same URL
    if (this.devices.some((d) => d.value === name)) {
      return;
    }

    this.devices.push({ value: name, name });
    localStorage.deviceNames = JSON.stringify(this.devices);
    this.setCurrentDevice(name);
  }

  async setCurrentDevice(value) {
    if (this.currentDevice === value) {
      return;
    }

    if (this.connected) {
      this.disconnect();
    }

    this._currentSocket = this._getSocket(value);
    if (this._currentSocket) {
      Vue.set(this, 'currentDevice', value);
      this.emit('currentDevice', value);
      await this.connect();
    } else {
      Vue.set(this, 'currentDevice', null);
      this.emit('currentDevice', null);
    }
  }

  async writeBuff(buff) {
    if (this._writeLock) {
      return;
    }

    // this is a hack that depends on 'compile-server' setting
    // the callback to invoke before write sequence starts
    if (this._beforeWriteFn) {
      const beforeWriteFn = this._beforeWriteFn;
      this._beforeWriteFn = null;
      this._writeLock = true;
      await beforeWriteFn();
      this._writeLock = false;
    }

    if (buff instanceof ArrayBuffer) {
      if (TRACE) {
        console.log('websocket-to-serial: send binary hex', Buffer.from(buff).toString('hex'));
      }
      this._currentSocket.send(buff);
    } else {
      console.warn(`websocket-to-serial: expected ArrayBuffer, got ${typeof buff}`);
    }
  }

  async write(message) {
    if (this.mute) {
      return;
    }

    await this.writeBuff(Buffer.from(message, this.encoding));
  }

  async connect() {
    if (!this._currentSocket) {
      console.log('websocket-to-serial: connect is called but no socket is selected');
      return;
    }

    console.log('websocket-to-serial: establishing connection');

    if (this._currentSocket.connected) {
      console.log('websocket-to-serial: already connected');
      return;
    }

    try {
      await this._currentSocket.connect();

      // set initial baud
      this._currentSocket.send(`baud:${this.baud}`);

      this.connected = true;
      this.emit('connected', this.currentDevice);
      console.log('websocket-to-serial: connected');
    } catch (err) {
      console.log('websocket-to-serial: connection failed', err);
    }
  }

  async disconnect() {
    if (!this._currentSocket) {
      return;
    }

    console.log('websocket-to-serial: disconnect requested');
    await this._currentSocket.close(1000);
    this.emit('disconnect', this.currentDevice);
  }

  async setSignals(signals) {
    if (!this._currentSocket) {
      return;
    }

    console.log(`websocket-to-serial: signal = ${signals}`);

    // [!] text frame
    if (signals === 'on' || signals === true) {
      this._currentSocket.send('dtr:1');
    }

    if (signals === 'off' || signals === false) {
      this._currentSocket.send('dtr:0');
    }
  }

  async setBaud(baud) {
    this.lastBaud = this.baud;
    this.baud = baud;

    // [!] text frame
    this._currentSocket.send(`baud:${baud}`);

    window.localStorage.currentBaudRate = baud;
    return baud;
  }
}

export default WebSocketSerial;
