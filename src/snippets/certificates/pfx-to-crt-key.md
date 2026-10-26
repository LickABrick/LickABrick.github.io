---
title: Convert PFX to CRT and KEY using OpenSSL
description: Extract a certificate, private key and optional CA chain from a PKCS#12 archive using OpenSSL 3.
date: 2026-10-26
platform: Cross-platform (Unix shell examples)
tags: [openssl, certificates, pfx]
permalink: /snippets/certificates/pfx-to-crt-key/
---

## Prepare

Use a private directory and unused output filenames. You need the PFX import password; let OpenSSL prompt rather than passing it on the command line.

```bash numbers=off
openssl version
# Restrict new files before extracting keys (Unix-like shells).
umask 077
```

On Windows, restrict the directory's NTFS permissions instead. Keep PFX archives and private keys out of Git and shared folders.

## Extract certificate

```bash numbers=off
openssl pkcs12 -in input.pfx -clcerts -nokeys -out certificate.crt
```

Enter the PFX import password. Output is PEM; `-clcerts` excludes CA certificates. For archives with multiple identities, check the intended certificate/key pair.

## Extract private key

For a service that requires an **unencrypted** key:

```bash numbers=off
openssl pkcs12 -in input.pfx -nocerts -noenc -out private.key
chmod 600 private.key
```

Anyone with this file can use the private key. OpenSSL 3 uses `-noenc`; OpenSSL 1.1.1 uses `-nodes` instead (deprecated in 3).

If the service supports an encrypted key, omit `-noenc` and choose an output PEM passphrase when prompted:

```bash numbers=off
openssl pkcs12 -in input.pfx -nocerts -out private-encrypted.key
```

Only add `-legacy` to extraction commands if an older PFX uses unsupported algorithms such as RC2. It does not fix an incorrect password. Output can include bag attributes; consumers requiring clean PEM may need normalization with `openssl pkey`.

## Optional CA chain

```bash numbers=off
openssl pkcs12 -in input.pfx -cacerts -nokeys -out ca-chain.crt
```

Check the service's required chain order and whether to omit a root certificate; extraction alone does not validate trust or completeness.

## Verify

```bash numbers=off
openssl x509 -in certificate.crt -noout -subject -issuer -dates -fingerprint -sha256
openssl pkey -in private.key -check -noout
# Public-key hashes must match; supports RSA and EC.
openssl x509 -in certificate.crt -pubkey -noout | openssl pkey -pubin -outform DER | openssl dgst -sha256
openssl pkey -in private.key -pubout -outform DER | openssl dgst -sha256
```

For an encrypted key, substitute `private-encrypted.key` and enter its PEM passphrase. Check every command for errors: failed pipelines can hash empty input. Matching hashes confirm the pair, not certificate trust or hostname validity. These commands do not print private-key material.

References: [OpenSSL pkcs12](https://docs.openssl.org/3.0/man1/openssl-pkcs12/), [pkey](https://docs.openssl.org/3.0/man1/openssl-pkey/), [x509](https://docs.openssl.org/3.0/man1/openssl-x509/). Inspired by [datvm's Gist](https://gist.github.com/datvm/4de10d7e8f034f62742a4b7effe32bb3).
