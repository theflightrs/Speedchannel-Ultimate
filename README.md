*Note: This chat is still in heavy development. Do not use seriously.*

## Introduction


Speedchannel is a multi-channel chat with open, private and hidden channel features and adjustable polling (boost and throttling). 

This purely PHP/JS-based application allows users to create open, private and hidden channels and send invitations to users of choice. The minimalistic interface ensures ease of use for any regular user, and leaves the most room for messaging.


![1scs](https://github.com/user-attachments/assets/ac82b908-58b3-4fb6-a90b-bd595efdb42a)

![2025-05-06 08 55 54 www graviton at 6e0ac3dcbfaf](https://github.com/user-attachments/assets/a2aa5f71-6ce5-4cc8-9823-03a39cf0e772)


Hypothetical use cases:
- Topic-based chat or collaborative (file) exchange
- Communication between different departments etc.
- Alternative to in-game chats
- Your personal notepad

**This chat is only for desktop screen use and not for mobile.**

  ## Install:
1) Copy all files to server
2) Enter database creds in config.php
3) Visit the chat once in the browser, this will create all the tables.
4) Register your admin user (e.g. "admin")
5) **Go to your MySQL table "users", edit your column "is_admin" - set it to "1" to assign admin rights.**

 ## Features

**Open / Private / Hidden Channels**

![2025-05-06 06 05 27 www graviton at fb754f602d46](https://github.com/user-attachments/assets/5113e364-19f3-4b25-97ce-347bafbd2ba3)

You can have general, large and open group chats or transform your channel into a private zone. Hidden channels are not listed in the sidebar.

**"Knocking" feature**

![0f4081028b62](https://github.com/user-attachments/assets/098c5ffa-3ab0-443d-8c57-62a308a62853)

Users can knock on private channels, which will send a knock request to the channel's creator.

**Channel invitations**

![invit](https://github.com/user-attachments/assets/d6994d10-5490-465d-980f-77750f6d5315)

Vice versa, the creators of channels can invite users too.

**Adjustable Polling and Efficiency**

The polling speed of the chat can be adjusted. 
It can increase on chat activity for a certain duration, and decrease on inactivity.

- **Fast Rate:** The fast polling speed when chat is active
- **Slow Rate:** The slow polling speed when the chat is inactive
- **Active Duration:** How long the fast rate should go before throttling back to slow.

![frp](https://github.com/user-attachments/assets/dfd1ed3a-d5e4-40d6-a825-1b7aa04b74db)


![pollingc](https://github.com/user-attachments/assets/5d174b15-c19b-4a92-a5f0-46d32828a95a)

This keeps your active chat in action and saves your bandwidth by pulsing slower for changes if "nothing's happening".

**Drag & Drop Uploads**

![dragdr](https://github.com/user-attachments/assets/77901ee2-3fb8-46ac-b5c7-9856c3f40010)

Use convenient drag & drop to pass files around. (Currently: Images)
Collect them in an attachment container before you send them.
 
 **Encryption**
 
Messages will be stored in the database. 
OpenSSL AES encryption and decryption is a core feature - all messages will be encrypted and decrypted automatically.
Your ENCRYPTION_KEY and algorithm can be set in **config.php**.

**Caution:** Changing your encryption key or phrase will render **all** past messages unreadable.

**Enhanced config editor**

![2025-05-06 08 05 06 www graviton at c76fe8dae3ee](https://github.com/user-attachments/assets/0fd62ad8-435c-4693-9cf3-4bef7890c06d)

This admin-panel config editor lets you make changes to the config.php file without you having to access your server file.
Values will be read and loaded into form items. An exclusion list in the backend makes sure sensitive values will not be loaded.


### Maintainers
- RS Snyder (https://www.rs-snyder.com)

### You are not allowed to use this application for commercial purposes! 

## Disclaimer 
The maintainer is not responsible for the misuse of Speedchannel's encryption or other features nor for any damage arises from it. 
This software was not
 tested by
 security professionals! Speedchannel was only made for personal, recreational purposes - and should not be used for professional communication.
