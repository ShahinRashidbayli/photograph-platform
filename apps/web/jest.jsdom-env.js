const JSDOMEnvironment = require('jest-environment-jsdom').default;

/**
 * jsdom, plus the web platform globals Node already has and jsdom does not.
 *
 * MSW v2 is built on the Fetch API: it constructs `Request` and `Response` to
 * represent what it intercepts. jsdom implements neither, so `msw/node` throws
 * "ReferenceError: Request is not defined" before any test runs.
 *
 * The usual answer is to polyfill from `undici` in a setup file, which means a
 * dependency on Node's HTTP internals to re-supply what this Node already has.
 * A test environment can do it without that: environment modules are loaded in
 * Node's own context, outside the sandbox, so the identifiers below are Node's
 * real implementations — the ones the application meets in production. They are
 * copied onto the jsdom window rather than reimplemented.
 *
 * `structuredClone` is here for the same reason; msw uses it to hand a request
 * body to more than one consumer.
 */
class FetchCapableJSDOMEnvironment extends JSDOMEnvironment {
  constructor(config, context) {
    super(config, context);

    for (const name of [
      'fetch',
      'Request',
      'Response',
      'Headers',
      'FormData',
      'ReadableStream',
      'WritableStream',
      'TransformStream',
      'ByteLengthQueuingStrategy',
      'CountQueuingStrategy',
      'TextEncoderStream',
      'TextDecoderStream',
      'DOMException',
      'crypto',
      'BroadcastChannel',
      'TextEncoder',
      'TextDecoder',
      'structuredClone',
      'Blob',
      'File',
    ]) {
      if (globalThis[name] !== undefined) {
        this.global[name] = globalThis[name];
      }
    }
  }
}

module.exports = FetchCapableJSDOMEnvironment;
