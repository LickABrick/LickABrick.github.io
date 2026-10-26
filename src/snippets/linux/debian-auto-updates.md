---
title: Automatic security updates on Debian 12 and 13
description: Configure unattended-upgrades with security-only origins and optional automatic reboots.
date: 2024-08-16
last_modified: 2026-10-26
category: Linux
platform: Debian 12 / 13
tags: [snippet, linux, debian, unattended-upgrades]
permalink: /snippets/linux/debian-auto-updates/
---

## Install packages

```bash numbers=off
sudo apt update
sudo apt install unattended-upgrades
# Optional changelog notices; configure delivery for unattended use.
sudo apt install apt-listchanges
```

## Create config

Keep the packaged `50unattended-upgrades` file. Create a local override:

```bash numbers=off
sudoedit /etc/apt/apt.conf.d/52unattended-upgrades-local
```

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

APT reads fragments in filename order; lists accumulate unless cleared. `${distro_codename}` selects bookworm (12) or trixie (13). Configure the security repository first; `.list` and deb822 `.sources` both work.

To also allow ordinary updates for the same release, add inside `Origins-Pattern`:

```text
"origin=Debian,codename=${distro_codename},label=Debian";
"origin=Debian,codename=${distro_codename}-updates,label=Debian";
```

Leave third-party repositories, backports and proposed updates excluded unless explicitly required. The cleanup settings remove unused kernels and newly unused dependencies, not all previously unused packages.

## Enable updates

```bash numbers=off
sudo dpkg-reconfigure -plow unattended-upgrades
```

Choose **Yes**. Confirm `/etc/apt/apt.conf.d/20auto-upgrades` contains:

```ini
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
```

```bash numbers=off
sudo systemctl enable --now apt-daily.timer apt-daily-upgrade.timer
systemctl list-timers --all apt-daily.timer apt-daily-upgrade.timer
```

`apt-daily` refreshes/downloads package information; `apt-daily-upgrade` installs updates. Timers include randomized delays, so daily eligibility does not mean an exact execution time.

## Optional automatic reboot

Reboots are disabled above. To allow a required reboot at 02:00 local time, replace the reboot settings:

```ini
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-WithUsers "false";
Unattended-Upgrade::Automatic-Reboot-Time "02:00";
```

This requires `/var/run/reboot-required` after an upgrade and avoids rebooting with logged-in users. Debian does not always create this marker: absence does not prove a reboot is unnecessary. This is a reboot time, not an installation window. Updates can restart services even with automatic reboots disabled; plan production maintenance accordingly.

## Test

```bash numbers=off
sudo unattended-upgrade --dry-run --debug
```

Check allowed origins and eligible packages. A dry run does not install updates.

## Check activity / troubleshoot

```bash numbers=off
apt-cache policy
apt-config dump | grep -E 'APT::Periodic|Unattended-Upgrade'
apt-mark showhold
systemctl status apt-daily.service apt-daily-upgrade.service unattended-upgrades.service
sudo journalctl -u apt-daily.service -u apt-daily-upgrade.service --since yesterday
sudo tail -n 50 /var/log/unattended-upgrades/unattended-upgrades.log
sudo tail -n 50 /var/log/unattended-upgrades/unattended-upgrades-dpkg.log
sudo tail -n 50 /var/log/apt/history.log
sudo tail -n 50 /var/log/dpkg.log
```

- Confirm actual `Upgrade:` transactions in APT history and version changes in dpkg logs; inspect rotated logs if needed.
- No eligible updates: check origins, holds, blacklists and dependency restrictions in the dry run. Do not broaden origins blindly.
- No scheduled activity: check timers and journal errors. Oneshot services being inactive after completion is normal; `unattended-upgrades.service` handles shutdown coordination.
- Resolve configuration prompts or repository/signature errors manually. Do not delete lock files or disable signature checks.

References: [Debian PeriodicUpdates](https://wiki.debian.org/PeriodicUpdates), [unattended-upgrade(8)](https://manpages.debian.org/trixie/unattended-upgrades/unattended-upgrade.8.en.html), [apt.conf(5)](https://manpages.debian.org/bookworm/apt/apt.conf.5.en.html).
