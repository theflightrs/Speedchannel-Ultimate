export class Lightbox {
    constructor() {
        this.init();
    }

    init() {
        if (!document.querySelector('.lightbox')) {
            const template = `
                <div class="lightbox" style="display: none;">
                    <div class="lightbox-overlay"></div>
                    <div class="lightbox-content">
                        <img src="" alt="">
                        <button class="lightbox-close">×</button>
                    </div>
                </div>`;
            document.body.insertAdjacentHTML('beforeend', template);
        }
        
        this.container = document.querySelector('.lightbox');
        this.image = this.container.querySelector('img');
        this.closeBtn = this.container.querySelector('.lightbox-close');
        
        this.bindEvents();
    }

    bindEvents() {
        this.closeBtn.addEventListener('click', () => this.hide());
        this.container.addEventListener('click', (e) => {
            if (e.target.classList.contains('lightbox-overlay')) {
                this.hide();
            }
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.hide();
        });
    }

    show(imageUrl) {
        this.image.src = imageUrl;
        this.container.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    hide() {
        this.container.style.display = 'none';
        document.body.style.overflow = '';
    }
}

export default Lightbox;