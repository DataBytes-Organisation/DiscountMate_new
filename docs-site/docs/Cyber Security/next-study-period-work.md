---
title: "Next Study Period Work"
sidebar_label: "Future Work"
---

# Next Study Period Work

A penetration testing report was completed for DiscountMate during Weeks 5 to 7 of Trimester 1, 2026.

The report identified several security issues that should be reviewed and worked on in the next study period.

## Purpose

The purpose of this page is to record the main security items that should be carried forward.

Some security work was completed during this study period, but the penetration testing findings should still be used as the main reference for future improvements.

## Penetration Test Findings to Carry Forward

The main findings that should be carried forward include:

- Content Security Policy header not set
- privilege escalation through client-controlled admin values
- excessive data exposure through query parameters
- insecure CORS policy
- unauthenticated product catalogue exposure
- sensitive data transmitted over unencrypted HTTP
- unauthenticated access to analytics endpoints
- information disclosure through uncaught exceptions
- missing rate limiting on the sign-in endpoint
- insecure JWT admin claims
- unauthenticated Swagger API documentation exposure

## Items Already Partly Addressed

Some related issues have already been partly addressed through this study period's cyber security work, including:

- authentication middleware
- rate limiting
- input validation
- input sanitisation
- abnormal traffic monitoring
- scraper protection
- honeypot logging

## Recommended Future Focus

The next study period should focus on:

- reviewing the full penetration testing report
- prioritising high and severe findings
- implementing stricter CORS configuration
- adding Content Security Policy and other security headers
- enforcing HTTPS for frontend and backend communication
- reviewing unauthenticated access to product, analytics, and Swagger endpoints
- strengthening role-based access control
- removing any client-controlled admin logic
- adding server-side limits for pagination and large data requests
- improving production error handling so debug information is not exposed
- retesting fixed vulnerabilities after changes are made

## CORS Note

CORS was identified as a future security improvement and should be handled in the next study period.

It has not been included as completed work in this handover.

## Request Size Limits Note

Request size limits should also be reviewed in the next study period.

This should include checking whether large payloads are blocked properly and whether Express body parser limits are configured safely.

## Summary

This study period created a stronger security foundation for the DiscountMate backend.

However, the penetration testing report should remain the main reference point for future security work, especially for CORS, HTTPS, security headers, Swagger exposure, server-side pagination limits, and further access control hardening.
