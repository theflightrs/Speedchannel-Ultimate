class AuthState {
    constructor() {
        if (AuthState.instance) return AuthState.instance;
        AuthState.instance = this;

        this._state = {
            isAuthenticated: false,
            user: null,
        };
        this._listeners = new Set();
        this._initializeSession(); // Unified session initialization
        
    }

    async _initializeSession() {
        // Skip session check if no session cookie is present
        if (!document.cookie.includes("session_id")) {
            this.setAuthState(false, null);
            return;
        }
        try {
   
            const response = await fetch('/api/session_check.php');
            if (!response.ok) throw new Error(`HTTP status ${response.status}`);
            const data = await response.json();
            this.setAuthState(data.success && data.user, data.user || null);
        } catch (error) {
            console.warn("Session check failed:", error.message); // Handle errors gracefully
            this.setAuthState(false, null);
            spinner.style.display = 'none';
        } finally {
            document.body.classList.remove('loading');
            spinner.style.display = 'none';
        }
    }

  

    static getInstance() {
        return AuthState.instance || new AuthState();
    }

    setAuthState(isAuthenticated, user = null) {
        this._state.isAuthenticated = isAuthenticated;
        this._state.user = user;
        this._state.lastActivity = isAuthenticated ? new Date().toISOString() : null;
        
        // Update UI elements when auth state changes
        if (isAuthenticated) {
            document.getElementById('currentChannelTitle').textContent = 'No channel selected';
            document.getElementById('channelInfo').hidden = false;
            
            // Ensure myAuth is hidden and chat interface is displayed
            const myAuth = document.querySelector('.myAuth');
            if (myAuth) myAuth.hidden = true;
            
            // Show chat interface and sidebar
            const chatInterface = document.getElementById('chatInterface');
            const sidebar = document.getElementById('sidebar');
            if (chatInterface) chatInterface.style.display = 'block';
            if (sidebar) sidebar.style.display = 'block';
        } else {
            // Show myAuth, hide chat interface and sidebar
            const myAuth = document.querySelector('.myAuth');
            if (myAuth) myAuth.hidden = false;
            
            const chatInterface = document.getElementById('chatInterface');
            const sidebar = document.getElementById('sidebar');
            if (chatInterface) chatInterface.style.display = 'none';
            if (sidebar) sidebar.style.display = 'none';
        }
        
        this._notifyListeners();
    }

    addListener(callback) {
        this._listeners.add(callback);
    }

    _notifyListeners() {
        this._listeners.forEach(callback =>
            callback(this._state.isAuthenticated, this._state.user)
        );
    }

    clearState() {
        this._state = {
            isAuthenticated: false,
            sessionId: null,
            lastActivity: null,
            user: null,
        };
        this._notifyListeners();
    }



}