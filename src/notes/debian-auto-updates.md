---
title: Enabling automatic (security) updates on Debian (12)
description: Steps to enable automatic security updates on Debian systems.
layout: post
tags: note
publish_date: 16-08-2024
---

Install required packages

``` shell-session
sudo apt update
sudo apt install unattended-upgrades apt-listchanges
```

Create config file (we remove the old config first)

``` shell-session
rm /etc/apt/apt.conf.d/50unattended-upgrades
sudo nano /etc/apt/apt.conf.d/50unattended-upgrades
```

Add config

``` ini
Unattended-Upgrade::Allowed-Origins {
    "${distro_id}:${distro_codename}-security";
};

Unattended-Upgrade::Package-Blacklist {
};

Unattended-Upgrade::Remove-Unused-Kernel-Packages "true";
Unattended-Upgrade::Remove-New-Unused-Dependencies "true";

Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-WithUsers "true";
Unattended-Upgrade::Automatic-Reboot-Time "02:00";

```

Enable automatic updates

``` shell-session
sudo nano /etc/apt/apt.conf.d/20auto-upgrades
```

Add/change following lines

``` ini
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
```

Test

``` shell-session
sudo unattended-upgrades --dry-run --debug
```
