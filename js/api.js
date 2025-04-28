class Api {
    constructor() {
        const pathParts = window.location.pathname.split('/');
        pathParts.pop(); // Remove the last part (index.php or empty)
        this.baseUrl = pathParts.join('/') + '/api';
        
        this.csrfToken = window.CSRF_TOKEN || '';
        this.defaultHeaders = {
            'X-CSRF-Token': this.csrfToken,
            'X-Requested-With': 'XMLHttpRequest'
        };
    }

    async request(endpoint, options = {}) {
        const endpointPath = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;
        const url = `${this.baseUrl}/${endpointPath}`;
        let response;

        try {
            // Debugging: Log outgoing request details
            console.debug(`[API] Requesting: ${url}`, options);

            response = await fetch(url, {
                ...options,
                headers: {
                    ...this.defaultHeaders,
                    ...options.headers
                },
                credentials: 'include'
            });

            const responseBodyText = await response.text();
            console.debug(`[API] Response: ${responseBodyText}`);

            if (!response.ok) {
                let errorMessage = `API Error: ${response.status}`;
                try {
                    const errorData = JSON.parse(responseBodyText);
                    errorMessage = errorData.error || errorMessage;
                } catch (parseError) {
                    errorMessage += ` - ${responseBodyText.substring(0, 150)}...`;
                }
                throw new Error(errorMessage);
            }

            // Ensure response is JSON
            try {
                return JSON.parse(responseBodyText);
            } catch (parseError) {
                throw new Error(`Failed to parse JSON: ${responseBodyText.substring(0, 150)}`);
            }
        } catch (error) {
            console.error('[API] Request failed:', error);
            throw error;
        }
    }

    async get(endpoint, options = {}) {
        return this.request(endpoint, { method: 'GET', ...options });
    }

    async post(endpoint, data, options = {}) {
        const headers = { ...options.headers };
        let body;

        if (data instanceof FormData) {
            body = data;
        } else {
            body = JSON.stringify(data);
            headers['Content-Type'] = 'application/json';
        }

        return this.request(endpoint, { method: 'POST', body, headers, ...options });
    }
}
export default Api;