**Note:** *This chat is still under heavy development. Use at your own risk (or better wait for the official completion).*

## Introduction

Speedchannel is a multi-channel chat with open, private and hidden channel features. 
This purely PHP/JS-based application allows users to create open, private and hidden channels and send invitations to users of choice. The minimalistic interface ensures ease of use for any regular user, and leaves the most room for messaging.

Hypothetical use cases:
- Topic-based chat (exchange)
- "Neighborhood chat"
- Communication between different departments etc.
- Alternative to in-game chats
- Your personal notepad



 ## Features

**Open / Private / Hidden Channels**

Users of the chat can coexist with open, private and hidden channels.
You can have general, large and open group chats or transform your channel into a private place.
Hidden channels are not listed in the sidebar.

### "Knocking" feature

Users can knock on private channels, which will send a knock request to the channel's creator.
![2025-05-06 07 00 40 www graviton at 0f4081028b62](https://github.com/user-attachments/assets/098c5ffa-3ab0-443d-8c57-62a308a62853)

### Channel invitation

Vice versa, the creators of channels can invite users.

![preq](https://github.com/user-attachments/assets/371ee7d0-4d2e-427d-a22b-41b4f9c66580)

### Adjustable Polling and Efficiency

The polling speed of the chat can be adjusted. 
It can increase on chat activity for a certain duration, and decrease on inactivity.

###
 
 ### Encryption
 
 AES encryption and decryption is a core feature - all messages will be stored encryptedly. 
Your key can be set in **config.php** (ENCRYPTION_KEY).



### Enhanced config editor

## Install:
- Drop all on server
- Enter database creds in config.php
- Visit the chat once in the browser, this will create all the tables.
- Register your admin user (e.g. "admin")
- Go to your MySQL table "users", edit your column "is_admin" and set it to 1.

Maintainers
- RS Snyder (https://www.rs-snyder.com), with assistance from the Github Copilot. 

### You are not allowed to use this application for commercial purposes! 

## Disclaimer 
The maintainer is not responsible for the misuse of Speedchannel's encryption or other features nor for any damage arises from it. 
This software was not
 tested by
 security professionals! Speedchannel was only made for personal, recreational purposes - and should not be used for professional communication.
