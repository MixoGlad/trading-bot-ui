/**
 * Live Price Stream Client (Node 22 Native)
 *
 * This utility leverages the global WebSocket API built into Node 22.
 */

export function connectToPriceStream(symbol = 'btcusdt', onPriceUpdate, options = {}) {
  const url = `wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@ticker`;
  const { maxRetries = Infinity, initialDelay = 1000, maxDelay = 30000 } = options;

  let reconnectAttempts = 0;
  let socket = null;
  let isExplicitlyClosed = false;

  const connect = () => {
    console.log(`[Stream] Connecting to ${symbol.toUpperCase()}...`);
    socket = new WebSocket(url);

    socket.onopen = () => {
      console.log(`[Stream] Connected to ${symbol.toUpperCase()} live data.`);
      reconnectAttempts = 0; // Reset attempts on successful connection
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (onPriceUpdate) onPriceUpdate(data.c);
      } catch (err) {
        console.error('[Stream] Failed to parse message:', err);
      }
    };

    socket.onerror = (error) => {
      console.error(`[Stream] WebSocket Error for ${symbol}:`, error.message);
    };

    socket.onclose = () => {
      if (isExplicitlyClosed) {
        console.log(`[Stream] Connection closed gracefully for ${symbol}.`);
        return;
      }

      const delay = Math.min(initialDelay * Math.pow(2, reconnectAttempts), maxDelay);
      console.warn(
        `[Stream] Connection lost for ${symbol}. Reconnecting in ${delay}ms... (Attempt ${reconnectAttempts + 1})`
      );

      setTimeout(() => {
        if (reconnectAttempts < maxRetries) {
          reconnectAttempts++;
          connect();
        }
      }, delay);
    };
  };

  connect();

  // Return a controller to stop the stream and the reconnection loop
  return {
    stop: () => {
      isExplicitlyClosed = true;
      if (socket) socket.close();
    },
  };
}

/**
 * Manages multiple price streams efficiently.
 */
export class PriceStreamManager {
  constructor(onPriceUpdate, options = {}) {
    this.activeStreams = new Map();
    this.onPriceUpdate = onPriceUpdate; // Unified callback(symbol, price)
    this.options = options;
  }

  /**
   * Starts watching one or more symbols.
   */
  watch(symbols) {
    const symbolsArray = Array.isArray(symbols) ? symbols : [symbols];
    symbolsArray.forEach((symbol) => {
      const sym = symbol.toLowerCase();
      if (!this.activeStreams.has(sym)) {
        const controller = connectToPriceStream(
          sym,
          (price) => this.onPriceUpdate(sym, price),
          this.options
        );
        this.activeStreams.set(sym, controller);
      }
    });
  }

  /**
   * Stops watching one or more symbols.
   */
  unwatch(symbols) {
    const symbolsArray = Array.isArray(symbols) ? symbols : [symbols];
    symbolsArray.forEach((symbol) => {
      const sym = symbol.toLowerCase();
      const controller = this.activeStreams.get(sym);
      if (controller) {
        controller.stop();
        this.activeStreams.delete(sym);
      }
    });
  }

  /**
   * Returns a list of currently watched symbols.
   */
  getWatchedSymbols() {
    return Array.from(this.activeStreams.keys());
  }

  stopAll() {
    this.activeStreams.forEach((stream) => stream.stop());
    this.activeStreams.clear();
  }
}
