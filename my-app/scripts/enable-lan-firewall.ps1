$ErrorActionPreference = 'Stop'
$ruleName = 'SlipSnap LAN 5173'
if (-not (Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue)) {
    New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Action Allow `
        -Protocol TCP -LocalPort 5173 -LocalAddress 192.168.110.22 `
        -RemoteAddress LocalSubnet -InterfaceAlias Ethernet -Profile Public,Private `
        -Program 'C:\Program Files\nodejs\node.exe' | Out-Null
}
