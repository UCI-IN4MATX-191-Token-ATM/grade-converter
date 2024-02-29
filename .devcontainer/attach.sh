#!/bin/bash

LOCAL_GITCONFIG="./.gitconfig.local"
ALL_GITCONFIG="./.gitconfig.all"
USER_PROFILE_FOLDER="./userConfig"

if [[ -f "$LOCAL_GITCONFIG" && -f "$ALL_GITCONFIG" ]]; then
  while IFS= read -r line
  do
    if ! grep -Fxq "$line" $LOCAL_GITCONFIG
    then
      key=$(echo $line | cut -d '=' -f 1)
      value=$(echo $line | cut -d '=' -f 2-)
      git config --file ~/.gitconfig "$key" "$value"
    fi
  done < $ALL_GITCONFIG
  rm -rf "$LOCAL_GITCONFIG" "$ALL_GITCONFIG"
fi

# Files in the userConfig folder will be copied to the user's home directory in the devcontainer
if [ -d "$USER_PROFILE_FOLDER" ]; then
  cp -r "$USER_PROFILE_FOLDER/." ~/
fi
