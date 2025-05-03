<?php
define('SECURE_ENTRY', true);
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Debug that this actually runs
error_log("[INDEX] Starting session check");

if (session_status() === PHP_SESSION_NONE) {
    session_start();
    error_log("[INDEX] Started new session: " . session_id());
}

// Debug security include
error_log("[INDEX] Including Security.php");
require_once('Security.php');
error_log("[INDEX] Security.php included");

$security = Security::getInstance();
error_log("[INDEX] Security instance created")
?>
<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
	<meta name="theme-color" content="#151b26"/>
    <meta http-equiv="X-UA-Compatible" content="ie=edge">

	
    <title>JUMP Chat</title>

    <link rel="stylesheet" href="css/styles.css">
    <link rel="stylesheet" href="css/modal.css">
    <link rel="shortcut icon" href="favicon.ico" type="image/x-icon"/>

    <style>
    /* Initial state */
    #loginForm, #sidebar, #messageInputArea, #chatInterface, .modal-overlay {
        display: none;
    }
   </style>

    <!-- Fixed the syntax error in the script tag -->
    <script nonce="<?php echo htmlspecialchars($csrfToken); ?>">
        window.CSRF_TOKEN = "<?php echo htmlspecialchars($csrfToken); ?>";
        window.MAX_FILE_SIZE = <?php echo MAX_FILE_SIZE; ?>;
        window.ALLOWED_MIME_TYPES = <?php echo json_encode(ALLOWED_MIME_TYPES); ?>;
    </script>
</head>
<body>

    <div id="app">


    <!-- Sidebar -->
   <div id="sidebar">
      <a href="https://www.graviton.at/chat2/">
                <div id="appIntro">
              <div id="logo" > </div><div id="appName">SpeedChannel</div>
                </div>
                </a>
                <div id="userInfo">
                    <span id="userDisplay"></span>
                    <button id="logoutBtn" data-action="logout">Logout</button>
                </div>
                <button id="createChanButton" data-action="create-channel">Create Channel</button>
                <!-- Channels Section -->
                <div id="channelSection">
             

                    <div class="section-header">
                        <h3>Channels</h3>           
                    </div>
                    <div id="channelList"></div>
                </div>

                <!-- Users Section -->
                <div id="userSection">
                    <h3>Users</h3>
                    <ul id="userList">
    <!-- User list items will be populated by JS -->
                     </ul>
                </div>
              
      <div id="invitationsList">
    <h3>Invitations</h3>
    <div id="invitationList"></div>
</div>


                <!-- Admin Section -->
                <div id="adminSection" hidden>
                  <!--  <h3> Admin </h3> -->
                   <button id="adminBtn" data-action="toggle-admin-panel">Admin Panel</button>
          
          <div id="adminPanel" class="admin-panel" hidden>
   
  <div class="admin-header">
        <h2>Admin Panel</h2>
        <button class="close-btn" data-action="hide-admin-panel">×</button>
    </div>
    
    <div class="admin-tabs">
        <button class="tab-btn active" data-tab="features">Features</button>
        <button class="tab-btn" data-tab="sessions">Sessions</button>
        <button class="tab-btn" data-tab="search">User Search</button>
        <button class="tab-btn" data-tab="logs">Activity Logs</button>
    </div>
    
    <div class="tab-content" id="featuresTab">
        <h3>Feature Management</h3>
        <div class="feature-toggles">
            <label class="toggle-switch">
                <input type="checkbox" id="sessionManagement" data-action="toggle-feature" data-feature="session_management">
				<p>What?</p>
                <span class="slider"></span>
                Session Management
            </label>
            
            <label class="toggle-switch">
                <input type="checkbox" id="userSearch" onchange="toggleFeature('user_search', this.checked)">
                <span class="slider"></span>
                Advanced User Search
            </label>
            
            <label class="toggle-switch">
                <input type="checkbox" id="activityLogging" onchange="toggleFeature('activity_logging', this.checked)">
                <span class="slider"></span>
                Activity Logging
            </label>
        </div>
    </div>
    
    <div class="tab-content" id="sessionsTab" hidden>
        <h3>Active Sessions</h3>
        <div class="session-filters">
            <input type="text" id="sessionSearch" placeholder="Search by username...">
            <select id="sessionSort">
                <option value="last_activity">Last Activity</option>
                <option value="ip_address">IP Address</option>
                <option value="user_agent">Browser</option>
            </select>
        </div>
        <div id="sessionsList"></div>
    </div>
    
    <div class="tab-content" id="searchTab" hidden>
        <h3>User Search</h3>
        <div class="search-controls">
            <input type="text" id="userSearchInput" placeholder="Search users...">
            <div class="search-filters">
                <select id="userRole">
                    <option value="">All Roles</option>
                    <option value="admin">Admins</option>
                    <option value="user">Regular Users</option>
                </select>
                <select id="userStatus">
                    <option value="">All Statuses</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                </select>
                <select id="sortBy">
                    <option value="username">Username</option>
                    <option value="created_at">Join Date</option>
                    <option value="last_login">Last Login</option>
                </select>
            </div>
        </div>
        <div id="userSearchResults"></div>
    </div>
    
    <div class="tab-content" id="logsTab" hidden>
        <h3>Activity Logs</h3>
        <div class="log-filters">
            <input type="date" id="logDate" value="2025-04-20">
            <select id="logType">
                <option value="">All Activities</option>
                <option value="auth">Authentication</option>
                <option value="user">User Management</option>
                <option value="channel">Channel Management</option>
                <option value="message">Messages</option>
            </select>
            <select id="logSeverity">
                <option value="">All Severities</option>
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="error">Error</option>
            </select>
        </div>
        <div id="activityLogs"></div>
    </div>
</div>
          
                </div>
            </div>
  
       

        <!-- Main Chat Interface -->
        <div id="chatInterface">
         
 
            <!-- Main Content -->
            <div id="mainContent">
                <!-- Channel Info -->
                <div id="channelInfo" hidden>
                    <h2 id="currentChannelTitle"></h2>
                    <div id="channel-controls" class="channel-controls" hidden>
                     <button id="manageUsersBtn" data-action="manage-users" disabled>Manage Users</button>
                      <button id="channelSettingsBtn" data-action="show-channel-settings" disabled>
                      <span class="icon">⚙</span>
                       </button>
                    </div>
                </div>
				
             


                <template id="knockMessageTemplate">
    <div class="knock-request">
        <span class="user"></span> is requesting to join
        <button class="accept">Accept</button>
        <button class="decline">Decline</button>
    </div>
</template>

                <!-- Message Display -->
                <div id="messageDisplay">



        <div class="spinnercontainer">
             <div class="spinner">
             <div></div>
             <div></div>
             <div></div>
             <div></div>
             <div></div>
        </div>



                </div>

    </div>        
            <div id="attachmentPreview" class="preview"></div>
                <!-- Message Input Area -->
                <div id="messageInputArea" hidden>
                    
                    <div class="input-container">
                        <button class="attachFilesbtn" data-action="attach-file"><span class="icon">📎</span>
                        </button>
                        <input type="file" id="fileInput" hidden>
                      <textarea id="messageInput" placeholder="Type a message..." ></textarea>
                        <button id="sendMessageBtn" class="sendBtn" data-action="send-message">Send</button>
                    </div>
                </div>
            </div>
        </div>


<div class="myAuth"  <?php echo $security->isAuthenticated() ? 'hidden' : ''; ?>>



 <!-- Login Form -->
 <div id="loginForm" class="auth-form" >
            <h2>Login</h2>
            <form id="loginFormElement">
                <div class="form-group">
                    <label for="loginUsername">Username</label>
                    <input type="text" id="loginUsername" required minlength="3" maxlength="50" autocomplete="username">
                </div>
                <div class="form-group">
                    <label for="loginPassword">Password</label>
                    <input type="password" id="loginPassword" required minlength="6" autocomplete="current-password">
                </div>
                <button type="submit" id="loginBtn" data-action="login">Login</button>
                <p>Don't have an account? <a href="#" data-action="toggle-auth" data-form="register">Register</a></p>
                <div id="loginError" class="error-message" hidden></div>
            </form>
        </div>

        <!-- Register Form -->
        <div id="registerForm" class="auth-form" hidden>
    
            <h2>Register</h2>
            <form id="registerFormElement">
                <div class="form-group">
                    <label for="registerUsername">Username</label>
                    <input type="text" id="registerUsername" required minlength="3" maxlength="50" 
                           pattern="[a-zA-Z0-9_]+" title="Letters, numbers, and underscores only"
                           autocomplete="username">
                </div>
                <div class="form-group">
                    <label for="registerPassword">Password</label>
                    <input type="password" id="registerPassword" required minlength="6"
                           autocomplete="new-password">
                </div>
                <div class="form-group">
                    <label for="confirmPassword">Confirm Password</label>
                    <input type="password" id="confirmPassword" required minlength="6"
                           autocomplete="new-password">
                </div>
               <button type="submit" data-action="register">Register</button>
                <p>Already have an account? <a href="#" data-action="toggle-auth" data-form="login">Login</a></p>
                <div id="registerError" class="error-message" hidden></div>
            </form>
        </div>
    


</div>










<!-- Channel Settings Modal -->
<div id="channelSettingsModal" class="modal" hidden>
    <div class="modal-content">
        <h2>Channel Settings</h2>
        <form id="channelSettingsForm">
            <div class="form-group">
            <label for="editChannelName">Channel Name</label> 
                <input type="text" id="editChannelName" name="name" required>
            </div>
            <div id="inliner" class="inlinemaker">
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="editChannelPrivate" name="is_private">
                        Private Channel
                    </label>
                </div>
                <div class="form-group" id="editDiscoverableGroup">
                    <label>
                        <input type="checkbox" id="editChannelDiscoverable" name="is_discoverable" checked>
                       Discoverable
                    </label>
                </div>
            </div>
            <div class="modal-buttons">
                <button type="submit" data-action="save-channel-settings">Save Changes</button>
                <button type="button" data-action="delete-channel" class="danger">Delete Channel</button>
                <button type="button" data-action="close-modal">Cancel</button>
            </div>
        </form>
    </div>
</div>


<div id="deleteChannelConfirmModal" class="modal" hidden>
    <div class="modal-content">
        <h2>Delete Channel</h2>
        <p>Are you sure you want to delete this channel? This action cannot be undone.</p>
        <div class="modal-buttons">
            <button type="button" data-action="confirm-delete-channel" class="danger">Delete</button>
            <button type="button" data-action="close-modal">Cancel</button>
        </div>
    </div>
</div>



    <!-- Create Channel Modal -->
    <div id="createChannelModal" class="modal" hidden>
        <div class="modal-content">
            <h2>Create Channel</h2>
          <form id="createChannelForm">
    <div class="form-group">
        <label for="channelName">Channel Name</label>
        <input type="text" id="channelName" name="channelName" required minlength="3" maxlength="100">
    </div>
   <div class="checkbox-group">
    <label class="checkbox-wrapper">
        <span class="custom-checkbox">
            <input type="checkbox" id="channelPrivate" name="channelPrivate">
            <span class="checkmark"></span>
        </span>
        <span class="checkbox-label">Private Channel</span>
    </label>

    <label class="checkbox-wrapper" style="display: none;">
        <span class="custom-checkbox">
            <input type="checkbox" id="channelDiscoverable" name="channelDiscoverable" checked>
            <span class="checkmark"></span>
        </span>
        <span class="checkbox-label">Discoverable</span>
    </label>
</div>
 <div class="modal-buttons">
        <button type="button" data-action="close-modal">Cancel</button>
        <button type="submit">Create</button>
    </div>

</form>
        </div>
    </div>

<!-- Manage Users Modal -->
<div id="manageUsersModal" class="modal" hidden>
    <div class="modal-content">
        <div class="modal-header">
            <div class="close" data-action="close-modal">&times;</div>
            <h2>Channel Users</h2>
        </div>
        <div class="modal-body">
            <div class="current-users-section">
                <h3>Current Users</h3>
                <div id="channelUsersList"></div>
            </div>
            <div class="available-users-section">
                <h3>Available Users</h3>
                <div id="availableUsersList"></div>
            </div>
        </div>
    </div>
</div>

<!-- Confirm Delete Modal -->
<div id="confirmDeleteModal" class="modal" hidden>
    <div class="modal-content">
        <h2>Confirm Deletion</h2>
        <p>Are you sure you want to delete this message?</p>
        <div class="modal-buttons">
        <button type="button" id="confirmDeleteBtn" class="danger" data-action="manual-delete" data-id="">Delete</button>
            <button type="button" data-action="close-modal" onclick="modalManager.hide('confirmDeleteModal')">Cancel</button>
        </div>
    </div>
</div>

    <!-- Scripts -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.1.1/crypto-js.min.js" 
        integrity="sha512-E8QSvWZ0eCLGk4km3hxSsNmGWbLtSCSUcewDQPQWZF6pEU8GlT8a5fF32wOl1i8ftdMhssTrF/OhyGWwonTcXA==" 
        crossorigin="anonymous" referrerpolicy="no-referrer"></script>

<!-- <script type="module" src="js/lightbox.js"></script> -->
<script type="module" src="./js/app.js"></script>
<script src="js/AuthState.js"></script>

   
  
</div>

<div class="lightbox" style="display: none;">
    <div class="lightbox-overlay"></div>
    <div class="lightbox-content">
        <img src="" alt="">
        <button class="lightbox-close">×</button>
    </div>
</div>

</body>
</html>