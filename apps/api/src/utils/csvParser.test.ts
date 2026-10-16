import { parseEmailFile, isValidEmail } from './csvParser';

describe('CSV & Email Parser', () => {
  it('validates standard email formats correctly', () => {
    expect(isValidEmail('test@domain.com')).toBe(true);
    expect(isValidEmail('user.name+tag@company.co.uk')).toBe(true);
    expect(isValidEmail('invalid-email')).toBe(false);
    expect(isValidEmail('@nodomain.com')).toBe(false);
  });

  it('parses plain text with one email per line', () => {
    const raw = `
      alice@example.com
      bob@example.com
      charlie@example.com
    `;
    const res = parseEmailFile(raw);
    expect(res.valid).toEqual([
      'alice@example.com',
      'bob@example.com',
      'charlie@example.com',
    ]);
    expect(res.duplicates).toBe(0);
  });

  it('parses CSV with header and deduplicates', () => {
    const raw = `Name,Email,Role
Alice,alice@example.com,Admin
Bob,bob@example.com,Member
Alice Clone,alice@example.com,Guest
Invalid,not-an-email,Viewer`;

    const res = parseEmailFile(raw);
    expect(res.valid).toEqual(['alice@example.com', 'bob@example.com']);
    expect(res.duplicates).toBe(1);
    expect(res.invalid).toEqual(['not-an-email']);
  });
});
