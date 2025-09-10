A simple TUI for sending casts on Farcaster

Install
There are several ways you can install Mast

Install Script
You can copy this command to download and run the install script

curl -fsSL https://stevedylan.dev/mast.sh | bash
Download and view script

Homebrew
Mast can be installed with Brew by using the command below.

brew install stevedylandev/mast-cli/mast-cli
Prebuilt Binary
Releases are prebuilt binaries that can be downloaded from the releases page

Build From Source
Building the CLI from source is pretty easy, just clone the repo, build, and install.

git clone https://github.com/stevedylandev/mast-cli && cd mast-cli && go build . && go install .
Setup
Before you start hoisting some bangers, run the auth command to authorize the CLI. You will need your FID and a Signer Private Key. You can easily generate one within the CLI by running the login command.

mast login
mast-login

This will provide a QR code for you to scan and will open an approval screen within Warpcast. If you prefer to provide your own signer yo ucan do so with the auth command.

mast auth
mast-auth

Tip

If you're not sure how to make a signer or prefer to make one locally, check out CastKeys or Farcaster Keys Server

Usage
To send a cast, simply run the command below.

mast new
You will be given the option to fill out different fields for the cast

Message
Main text body of your cast

URL
https://github.com/stevedylandev/mast-cli

URL
https://docs.farcaster.xyz

Channel ID
dev
You can also use optional flags to bypass the interactive TUI for a quick cast

NAME:
mast new - Send a new Cast

USAGE:
mast new [command options]

OPTIONS:
--message value, -m value Cast message text
--url value, -u value URL to embed in the cast
--url2 value, --u2 value Second URL to embed in the cast
--channel value, -c value Channel ID for the cast
--help, -h show help
mast-new

Note

To cast in a channel make sure you are already a member

Questions
If you have an quesitons or issues feel free to contact me!
