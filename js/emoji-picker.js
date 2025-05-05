/**
 * Emoji Picker Component
 * 
 * This file implements a simple emoji picker for the blog's comment system.
 * It allows users to select emojis from the emoji directory and insert them into text areas.
 */

class EmojiPicker {
    constructor(options = {}) {
        this.trigger = options.trigger || '.emoji-picker-trigger';
        this.target = options.target || null;
        this.position = options.position || 'bottom';
        this.emojis = [
            { emoji: '🤒', description: '发烧' },
            { emoji: '🤔', description: '思考' },
            { emoji: '🤗', description: '拥抱' },
            { emoji: '🤡', description: '小丑' },
            { emoji: '🤪', description: '搞怪' },
            { emoji: '😀', description: '笑脸' },
            { emoji: '😊', description: '微笑' },
            { emoji: '😨', description: '害怕' },
            { emoji: '😪', description: '困倦' },
            { emoji: '😭', description: '哭泣' }
        ];
        
        this.pickerElement = null;
        this.isOpen = false;
        
        this.init();
    }
    
    init() {
        // Create emoji picker element
        this.createPickerElement();
        
        // Add event listeners to trigger buttons
        document.querySelectorAll(this.trigger).forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                // Get the target input/textarea
                const targetId = button.getAttribute('data-target');
                this.target = document.getElementById(targetId);
                
                // Toggle picker visibility
                this.togglePicker(button);
            });
        });
        
        // Close picker when clicking outside
        document.addEventListener('click', (e) => {
            if (this.isOpen && !this.pickerElement.contains(e.target) && 
                !e.target.matches(this.trigger)) {
                this.closePicker();
            }
        });
    }
    
    createPickerElement() {
        // Create picker container
        this.pickerElement = document.createElement('div');
        this.pickerElement.className = 'emoji-picker';
        this.pickerElement.style.display = 'none';
        
        // Create emoji grid
        const emojiGrid = document.createElement('div');
        emojiGrid.className = 'emoji-grid';
        
        // Add emojis to grid
        this.emojis.forEach(item => {
            const emojiButton = document.createElement('button');
            emojiButton.className = 'emoji-item';
            emojiButton.innerHTML = item.emoji;
            emojiButton.title = item.description;
            
            emojiButton.addEventListener('click', (e) => {
                e.preventDefault();
                this.insertEmoji(item.emoji);
            });
            
            emojiGrid.appendChild(emojiButton);
        });
        
        this.pickerElement.appendChild(emojiGrid);
        document.body.appendChild(this.pickerElement);
    }
    
    togglePicker(triggerButton) {
        if (this.isOpen) {
            this.closePicker();
            return;
        }
        
        // Position the picker
        const buttonRect = triggerButton.getBoundingClientRect();
        this.pickerElement.style.display = 'block';
        
        if (this.position === 'bottom') {
            this.pickerElement.style.top = `${buttonRect.bottom + window.scrollY}px`;
            this.pickerElement.style.left = `${buttonRect.left + window.scrollX}px`;
        } else if (this.position === 'top') {
            this.pickerElement.style.bottom = `${window.innerHeight - buttonRect.top + window.scrollY}px`;
            this.pickerElement.style.left = `${buttonRect.left + window.scrollX}px`;
        }
        
        this.isOpen = true;
    }
    
    closePicker() {
        this.pickerElement.style.display = 'none';
        this.isOpen = false;
    }
    
    insertEmoji(emoji) {
        if (!this.target) return;
        
        const start = this.target.selectionStart;
        const end = this.target.selectionEnd;
        const text = this.target.value;
        const before = text.substring(0, start);
        const after = text.substring(end, text.length);
        
        this.target.value = before + emoji + after;
        this.target.focus();
        this.target.selectionStart = this.target.selectionEnd = start + emoji.length;
        
        // Close picker after selection
        this.closePicker();
    }
}

// Initialize emoji picker when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Add emoji picker CSS
    const style = document.createElement('style');
    style.textContent = `
        .emoji-picker {
            position: absolute;
            z-index: 1000;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
            padding: 10px;
            max-width: 250px;
        }
        
        .emoji-grid {
            display: grid;
            grid-template-columns: repeat(5, 1fr);
            gap: 5px;
        }
        
        .emoji-item {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 40px;
            height: 40px;
            font-size: 24px;
            background: none;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            transition: background-color 0.2s;
        }
        
        .emoji-item:hover {
            background-color: #f0f0f0;
        }
        
        .emoji-picker-trigger {
            cursor: pointer;
            font-size: 20px;
            margin-right: 5px;
            background: none;
            border: none;
            padding: 5px;
            color: #666;
            transition: color 0.2s;
        }
        
        .emoji-picker-trigger:hover {
            color: #007bff;
        }
        
        .emoji-input-wrapper {
            display: flex;
            align-items: center;
        }
    `;
    document.head.appendChild(style);
    
    // Initialize emoji picker
    window.emojiPicker = new EmojiPicker();
}); 