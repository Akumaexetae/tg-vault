import { describe, expect, it } from 'vitest';
import { parseProxy } from './proxy';

describe('parseProxy', () => {
  it('parses host:port with no credentials', () => {
    expect(parseProxy('192.168.1.10:8080')).toEqual({
      rules: '192.168.1.10:8080',
      username: undefined,
      password: undefined,
    });
  });

  it('parses user:pass@host:port', () => {
    expect(parseProxy('bob:s3cret@proxy.example.com:3128')).toEqual({
      rules: 'proxy.example.com:3128',
      username: 'bob',
      password: 's3cret',
    });
  });

  it('keeps colons inside the password', () => {
    expect(parseProxy('bob:pa:ss@host:9000')?.password).toBe('pa:ss');
  });

  it('strips a scheme prefix', () => {
    expect(parseProxy('http://proxy.local:8888')?.rules).toBe('proxy.local:8888');
  });

  it('rejects input without a port', () => {
    expect(parseProxy('proxy.example.com')).toBeNull();
    expect(parseProxy('   ')).toBeNull();
  });
});
