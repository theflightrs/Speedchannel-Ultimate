 const BASE_URL = window.location.pathname.replace(/\/[^\/]*$/, '');

 class Auth {
    constructor(app) {
        this.app = app;
        this.authState = AuthState.getInstance();
        this.user = null;
        this.initialized = false;
        this._initializeEventListeners(); // Changed to private method name
    }

    _initializeEventListeners() { // Changed to private method
        document.getElementById('registerForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleRegister();
        });

        document.getElementById('loginForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        document.getElementById('logoutBtn')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.logout();
        });

        document.querySelectorAll('[data-action="toggle-auth"]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleAuthForm(e.target.dataset.form);
            });
        });
    }
    async handleLogin() {
        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value;
        const errorDiv = document.getElementById('loginError');

        errorDiv.hidden = true;
      //   document.getElementById('messageInputArea').display = false;
        document.getElementById("messageInputArea").style.display = "none";
  
        try {
            const spinner = document.getElementById('spinner');
            if (spinner) spinner.style.display = 'block'; // Show spinner
            const response = await this.app.api.post('/auth.php', {
                action: 'login',
                username: username,
                password: password
                
            });

            if (response.success && response.user) {
                this.user = response.user;
                this.app.currentUser = response.user;  // Add this line
                this.authState.setAuthState(true);
                document.getElementById('userDisplay').textContent = response.user.username;
                await this.app.userManager.loadUsers();
                await this.app.channels.loadChannels();
                return response;
            }
        } catch (error) {
            console.error('Login failed:', error);
            errorDiv.textContent = error.message;
            errorDiv.hidden = false;
        }
    }


    async handleRegister() {
        const username = document.getElementById('registerUsername').value.trim(); // Added trim
        const password = document.getElementById('registerPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const errorDiv = document.getElementById('registerError');
        errorDiv.hidden = true; // Hide previous errors

        if (password !== confirmPassword) {
            errorDiv.textContent = 'Passwords do not match';
            errorDiv.hidden = false;
            return;
        }
        if (!username || !password) { // Added check for empty fields
            errorDiv.textContent = 'Username and password are required';
            errorDiv.hidden = false;
            return;
        }


        try {
             // *** Corrected fetch call using this.app.api ***
            const data = await this.app.api.post('/auth.php', {
                action: 'register',
                username: username,
                password: password
            });

            // Api.request handles non-success errors
            if (data.success) {
                this.toggleAuthForm('login');
                const loginError = document.getElementById('loginError');
                loginError.textContent = 'Registration successful! Please log in.';
                loginError.style.color = '#4CAF50'; // Consider using CSS classes
                loginError.hidden = false;
            } else {
                 // This case should ideally not be reached
                 console.warn("Register API call succeeded but data indicates failure:", data);
                 throw new Error(data.error || 'Registration failed: Invalid response from server');
            }
        } catch (error) {
             console.error("Registration failed:", error);
            errorDiv.textContent = error.message;
            errorDiv.hidden = false;
        }
    }

    isAuthenticated() {
        return !!this.user;
    }

    async logout() {
        try {
            await this.app.api.post('/auth.php', { action: 'logout' });
     
            this.authState.setAuthState(false);
            this.authState.clearState();
            // Update UI state
  
            // Clear user and channel data
            if (this.app.userManager) this.app.userManager.clearUsers();
            if (this.app.channels) this.app.channels.clearChannels();
            if (this.app.chat) this.app.chat.clearMessages();

            this.toggleAuthForm('login');
    
            console.log('Logout successful');
        } catch (error) {
            console.error('Logout failed:', error);
        }
    }

    toggleAuthForm(form) {
        document.getElementById('loginForm').hidden = form === 'register';
        document.getElementById('registerForm').hidden = form === 'login';
        document.getElementById('loginError').hidden = true;
        document.getElementById('registerError').hidden = true;
    }
}

export default Auth;