#!/bin/sh
# The fake agent the tests install (run.js): it says where it runs and echoes what it is sent (cat), and has accounts
# as Claude Code has (agents.js, config): `auth login` opens its sign-in page ($FAKE_SIGNIN_PAGE) with $BROWSER, as
# Claude Code does, and signs in to the email the human types (none: not signed in); `auth status` says the email
# (ends with 1 when signed out); `auth logout` signs out, noted in $FAKE_LOGOUTS.
case "$1 $2" in
  "--version "*) echo "kulisa-fake-agent 1.2.3"; exit;;
  "auth login")
    [ -n "$BROWSER" ] && "$BROWSER" "$FAKE_SIGNIN_PAGE"
    echo "Sign in as? Type an email"
    read -r who
    [ -n "$who" ] || exit 1
    printf '%s' "$who" > "$FAKE_CONFIG_DIR/account"
    echo "Signed in"; exit;;
  "auth status")
    [ -f "$FAKE_CONFIG_DIR/account" ] || exit 1
    printf '{"loggedIn":true,"email":"%s"}\n' "$(cat "$FAKE_CONFIG_DIR/account")"; exit;;
  "auth logout") rm -f "$FAKE_CONFIG_DIR/account"; echo "$FAKE_CONFIG_DIR" >> "$FAKE_LOGOUTS"; exit;;
esac
echo "fake agent in $PWD, ports + $KULISA_PORT_OFFSET, config [$FAKE_CONFIG_DIR]"
exec cat
