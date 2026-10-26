---
title: Convert PFX to CRT and KEY using OpenSSL
description: Extract a certificate, private key and optional CA chain from a PKCS#12 archive using OpenSSL 3.
date: 2026-10-26
category: Certificates
platform: Cross-platform (Unix shell examples)
tags: [snippet, openssl, certificates, pfx]
permalink: /snippets/certificates/pfx-to-crt-key/
---

You need OpenSSL and the PFX/PKCS#12 archive's import password. `.crt` below contains a PEM certificate, not just a public key. Work in a private directory; do not overwrite existing key files.

## Check the version and restrict access

```bash
openssl version
# Unix-like shells: restrict newly created files before extracting any key.
umask 077
```

On Windows, use an appropriately restricted NTFS directory/ACL instead of `umask`. Keep PFX archives and private keys out of Git, shared folders and command logs. Never pass passwords directly as command-line arguments; let OpenSSL prompt.

## Extract certificate and key

```bash
openssl pkcs12 -in input.pfx -clcerts -nokeys -out certificate.crt
# Encrypted private key (prompts for an output PEM passphrase):
openssl pkcs12 -in input.pfx -nocerts -out private-encrypted.key
```

Each command prompts for the PFX import password. `-clcerts` selects non-CA certificates; for an archive with multiple identities, select and inspect the intended certificate/key rather than assuming the first pair is correct.

If your service **requires an unencrypted key**, extract it directly instead of creating an encrypted intermediate:

```bash
openssl pkcs12 -in input.pfx -nocerts -noenc -out private.key
chmod 600 private.key
```

`-noenc` is OpenSSL 3's option for unencrypted private-key output. OpenSSL 1.1.1 uses `-nodes` instead; that spelling is deprecated in OpenSSL 3. Prefer encrypted keys when the consuming application supports them. Anyone who reads an unencrypted private key can impersonate its owner.

Only when an older PFX archive fails because of unsupported legacy encryption (for example RC2), retry the relevant `pkcs12` extraction with `-legacy`. This loads legacy algorithm support; it is not a general fix for a wrong password and should not be the default.

Optional CA/intermediate certificates:

```bash
openssl pkcs12 -in input.pfx -cacerts -nokeys -out ca-chain.crt
```

The bundle can contain multiple CA certificates, including a root. Inspect ordering and your service's chain requirements; extracting it does not establish trust or prove the chain is complete. Private-key outputs can include bag attributes; consumers that demand clean PEM may need normalization with `openssl pkey`.

## Inspect and match without exposing private material

```bash
openssl x509 -in certificate.crt -noout -subject -issuer -dates -fingerprint -sha256
openssl pkey -in private.key -check -noout
# These SHA-256 digests must match (works for RSA and EC keys):
openssl x509 -in certificate.crt -pubkey -noout | openssl pkey -pubin -outform DER | openssl dgst -sha256
openssl pkey -in private.key -pubout -outform DER | openssl dgst -sha256
```

For an encrypted key, substitute `private-encrypted.key`; OpenSSL prompts for its PEM passphrase. Check **every command** for errors before comparing digests: a failed pipeline can hash empty input. A matching public key proves the pair belongs together, not that the certificate is valid, trusted or suitable for a particular hostname. Do not use commands that print the private key itself.

Inspired by [datvm's PFX extraction Gist](https://gist.github.com/datvm/4de10d7e8f034f62742a4b7effe32bb3). Command references: [OpenSSL 3 pkcs12](https://docs.openssl.org/3.0/man1/openssl-pkcs12/), [pkey](https://docs.openssl.org/3.0/man1/openssl-pkey/), [x509](https://docs.openssl.org/3.0/man1/openssl-x509/). Documentation-reviewed; not yet verified in a certificate test environment.
