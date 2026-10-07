---
name: code-review
description: Review pull requests for correctness, security, regressions, maintainability, testing, and repository standards. Use this skill whenever reviewing code changes or pull requests.
---

# Code Review

Review the proposed changes as a senior software engineer.

## Review priorities

Check in this order:

1. Correctness
   - Logic errors
   - Incorrect assumptions
   - Edge cases
   - Race conditions
   - Broken error handling

2. Security
   - Hardcoded secrets
   - Authentication/authorization problems
   - Injection vulnerabilities
   - Unsafe user input
   - Sensitive data exposure

3. Regressions
   - Existing functionality that may break
   - API compatibility
   - Database/schema compatibility

4. Testing
   - Missing tests
   - Tests that do not cover important failure cases
   - Tests that pass without actually validating behaviour

5. Maintainability
   - Unnecessary complexity
   - Duplication
   - Poor abstractions
   - Misleading naming

6. Performance
   - Unnecessary database queries
   - Expensive loops
   - Memory leaks
   - Blocking operations

## Review behaviour

Only report issues that are actionable.

For every issue provide:

- Severity: Critical / High / Medium / Low
- File and relevant code
- Why it is a problem
- A concrete recommended fix

Do not report purely stylistic preferences unless they violate repository conventions.

Prioritize correctness and security over formatting.
