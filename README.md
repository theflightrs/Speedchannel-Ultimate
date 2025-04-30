Channel-based chat where users can create open or private chat channels. 

User experience of the chat in a nutshell:

(Any) user visits the page, sees the login form, logs in and sees the sidebar, a channel list, a list of all registered users appear through one source of login state truth.<br>
The user can enter non-private (open) chat channels and chat with others in that channel.<br>
There should also be private channels where the creators can add users from the list of all registered users.<br>
The user who gets invited to a channel should face a modal dialog with "[username] wants you to join [channel name]" with an accept and a decline button.<br>
Once accepted, the user will get that specific channel opened. The creator of the channel should see the assigned user being added to the "Manage Users" list.<br>
The channel item's lock icon 
Users then should chat normally, with the messageDisplay being the container for nicely stretched, stacked messages and a display with a marking of username and time.<br>
Users should also be able to attach files, which should be listed in a horizontal preview. Each file should also be able to be deleted in that preview.<br>
Sent files should also be able to be to be displayed in its respective message under the message text/content. .exe files or other executable (script) files should not be allowed. <br>
<br>
Users should not be able to join private channels by themselves. They have to be assigned. <br>
However, they should be able to click on a private channel's name and send a "[username] is knocking. [Accept/Decline]" as a generic message into the respective chat, but only once every 60 seconds (this should be changeable in e.g. config.<br> 
The main administrator should be able to have access to any channel and remove users and messages. Channel creators should be able to remove messages from their own channel while users may delete their own. <br>
If the user logs out, he should return to only the login form. The sidebar and all other elements should disappear.<br><br>

Channel list:
- Simple list of channel names
- Open channels are available to everyone
- Private, discoverable channels can only be entered if the creator assigns users to them.
- Users must be able to knock "knock" on a private channel by clicking its name. It should then send a "knock request" as a message that gets posted within the specific channel. Channel creators can then accept or decline such requests.
- Non, discoverable private channels should not be listed in the channel list. Creators will pick registered users themselves by assigning them from the available users under "Mange Users".

Technical goals:
- Clean session handling, one sort of truth eventually decided in Security.php. <br>
- Clean encryption and decription of stored and sent messages <br>
- In case of a change of the main encryption key, each message stored in the database must be safely re-encrypted based on the new key.
- index.php is the main interface. Manual and display functions come from there and must be reflected there for the utmost user friendliness.<br>
- Later, it is desired to have a settings modal for administrators with an interface that reads and returns the classes of the CSS file(s) into a listed form where changes made can be saved. That listed form should have color selectors for color and size properties, but only to style user interface elements to customize their installation. A "restore default" should apply the CSS that came out of the box.<br> 
- A responsive mobile design would be beneficial. 
- Future plan: Leaving the possibility open for end-to-end encryption or a decentralization function, where messages will only be stored in the client's local storage or similar <br>
- Drag and drop file sending with the messageInput field. Horizontal preview strip of files above in the messageInputArea above the input field. Files should then be displayed and loaded in the sent message, eventually with a "Show attachments" button that expands a grid list of attached files. If it is a single image file, it should display as a bigger picture. .exe and other scripts should not be allowed.
