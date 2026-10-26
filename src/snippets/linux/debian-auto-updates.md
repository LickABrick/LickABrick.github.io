---
title: Automatic security updates on Debian 12 and 13
description: Configure unattended-upgrades safely, inspect APT timers and diagnose missed security updates.
date: 2024-08-16
last_modified: 2026-10-26
category: Linux
platform: Debian 12 / 13
tags: [snippet, linux, debian, unattended-upgrades]
permalink: /snippets/linux/debian-auto-updates/
---

Use a local override instead of deleting the packaged `50unattended-upgrades` configuration. These instructions target Debian 12 (bookworm) and Debian 13 (trixie) with systemd. They were checked against documentation, not executed on a Debian test machine.

## Install and enable

```bash
sudo apt update
sudo apt install unattended-upgrades
# Optional: changelog notices (configure delivery for unattended use)
sudo apt install apt-listchanges
sudo dpkg-reconfigure -plow unattended-upgrades
```

Choose **Yes** to enable automatic updates. Confirm `/etc/apt/apt.conf.d/20auto-upgrades` contains:

```ini
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
```

The values mean daily eligibility, not an exact execution time. APT's timers determine when work runs.

## Select security origins explicitly

APT reads configuration fragments in lexical order. Later scalar settings override earlier ones, but lists can accumulate; use `#clear` before replacing them. Keep `/etc/apt/apt.conf.d/50unattended-upgrades` for package-managed defaults and create a local file:

```bash
sudoedit /etc/apt/apt.conf.d/52unattended-upgrades-local
```

For security-only updates:

```text
#clear Unattended-Upgrade::Allowed-Origins;
#clear Unattended-Upgrade::Origins-Pattern;
Unattended-Upgrade::Origins-Pattern {
    "origin=Debian,codename=${distro_codename}-security,label=Debian-Security";
};

Unattended-Upgrade::Remove-Unused-Kernel-Packages "true";
Unattended-Upgrade::Remove-New-Unused-Dependencies "true";
Unattended-Upgrade::Remove-Unused-Dependencies "false";
Unattended-Upgrade::Automatic-Reboot "false";
Unattended-Upgrade::Automatic-Reboot-WithUsers "false";
```

`${distro_codename}` expands to the installed release (bookworm or trixie). Confirm repository metadata with `apt-cache policy`; the security repository must be enabled in your sources. Debian 13 commonly uses deb822 `.sources` files; Debian 12 installations may use `.list` files. The origin matching works with either format. Use codenames rather than `stable` to avoid silently following the next Debian release.

To also permit ordinary updates for the **same release**, add these entries inside the `Origins-Pattern` block:

```text
"origin=Debian,codename=${distro_codename},label=Debian";
"origin=Debian,codename=${distro_codename}-updates,label=Debian";
```

Do not broadly allow every origin. Third-party repositories, backports and proposed updates need deliberate policies; an enabled repository is not automatically trusted by unattended-upgrades. Security-only selection can also keep packages back when dependencies require packages outside allowed origins—inspect the dry-run output rather than broadening origins blindly.

The cleanup settings remove unused kernel packages and dependencies made unused by this upgrade, not every previously unused package. Review APT's automatically-installed package markings before enabling wider autoremove.

## Reboots: opt in, never assume

The example above **does not reboot automatically**. Updates may still restart services; plan for backups, monitoring and service availability on production hosts.

If your maintenance policy permits a reboot at 02:00 local machine time, replace the reboot settings with:

```ini
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-WithUsers "false";
Unattended-Upgrade::Automatic-Reboot-Time "02:00";
```

This schedules a reboot when `/var/run/reboot-required` exists after an upgrade; it does not establish a complete maintenance window for package installations. Logged-in users inhibit automatic reboot with the explicit setting above. Debian systems do not universally create this marker for every update that warrants a reboot. Its absence is **not** proof that a new kernel or library is already running. Check your host's reboot-notification tooling and arrange manual maintenance where necessary.

## Timers and a safe dry run

```bash
systemctl list-timers --all apt-daily.timer apt-daily-upgrade.timer
systemctl status apt-daily.timer apt-daily-upgrade.timer
systemctl cat apt-daily.timer apt-daily-upgrade.timer
sudo systemctl enable --now apt-daily.timer apt-daily-upgrade.timer
sudo unattended-upgrade --dry-run --debug
```

`apt-daily.timer` refreshes/downloads package information; `apt-daily-upgrade.timer` runs the installation/cleanup path. Randomized delays and persistent catch-up mean they need not run at their nominal times. Services are normally oneshot and may be inactive after a successful run; that is not itself an error. `unattended-upgrades.service` handles shutdown coordination, not the periodic schedule.

A dry run should list allowed origins and eligible packages without installing them. It is not evidence of an actual successful upgrade.

## Verify activity and troubleshoot

```bash
apt-cache policy
apt-config dump | grep -E 'APT::Periodic|Unattended-Upgrade'
apt-mark showhold
systemctl status apt-daily.service apt-daily-upgrade.service unattended-upgrades.service
sudo journalctl -u apt-daily.service -u apt-daily-upgrade.service --since yesterday
sudo tail -n 100 /var/log/unattended-upgrades/unattended-upgrades.log
sudo tail -n 100 /var/log/unattended-upgrades/unattended-upgrades-dpkg.log
sudo tail -n 100 /var/log/apt/history.log
sudo tail -n 100 /var/log/dpkg.log
```

Look for actual `Upgrade:` transactions in APT history and matching package/version changes in dpkg logs. Check installed versions with `dpkg-query -W package-name` (replace the placeholder). Logs may be rotated/compressed; inspect older files when needed.

- **No eligible packages:** run `sudo apt update`, inspect `apt-cache policy`, installed versions, holds, blacklists and the dry-run's allowed origins. “No packages found” can be a successful no-op.
- **Unexpected origins:** check all later fragments for appended lists or overrides. Use `#clear` as shown; do not confuse suite names with codenames.
- **No scheduled activity:** check timer enablement, journal errors, machine uptime and periodic settings. Do not delete APT/dpkg lock files; wait for active package-manager processes.
- **Kept-back packages or configuration prompts:** read the dpkg log and resolve deliberately in a maintenance session. Do not force configuration replacement automatically just to silence a failure.
- **Download/signature failures:** fix repository URLs, expiry/key configuration, networking and system time. Do not disable signature verification.

References: [Debian PeriodicUpdates](https://wiki.debian.org/PeriodicUpdates), [Debian 13 unattended-upgrade(8)](https://manpages.debian.org/trixie/unattended-upgrades/unattended-upgrade.8.en.html), [Debian 12 apt.conf(5)](https://manpages.debian.org/bookworm/apt/apt.conf.5.en.html). Inspect the packaged configuration on your release before applying local policy.
