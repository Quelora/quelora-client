/*!
 * QUELORA – Real-time interaction platform for websites
 * 
 * @author German Zelaya
 * @version 1.0.0
 * @since 2023
 Licensed under the GNU Affero General Public License v3.0
 * 
 * Copyright (C) 2025 German Zelaya
 * 
 * QUELORA is an open-source platform designed to add real-time comments,
 * posts, and reactions to websites. Its lightweight widget (~170KB uncompressed)
 * integrates easily into any page without the need for frameworks like React
 * or jQuery. It includes support for AI-powered automated moderation,
 * engagement analytics, and a multi-tenant dashboard to manage multiple sites
 * from a single interface.
 * 
 * This script is part of the QUELORA project, available at:
 * https://www.quelora.org/
 * 
 * This program is free software: you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

const ImageCropper = (function() {
    class Cropper {
        constructor(options = {}) {
            this.options = {
                aspectRatio: 1,
                type: 'avatar',
                onConfirm: () => {},
                onCancel: () => {},
                ...options
            };
            this.isDragging = false;
            this.dragStartX = 0;
            this.dragStartY = 0;
            this.selectionStartX = 0;
            this.selectionStartY = 0;
            this.selectionStartWidth = 0;
            this.selectionStartHeight = 0;
            this.resizeDirection = null;
            this.initializeCropper();
        }
        
        initializeCropper() {
            this.createModal();
            this.setupEventListeners();
        }
        
        createModal() {
            this.modal = document.createElement('div');
            this.modal.className = 'quelora-cropper-modal';
            
            const container = document.createElement('div');
            container.className = 'quelora-cropper-container';
            
            const instructions = document.createElement('div');
            instructions.className = 'quelora-cropper-instructions t';
            instructions.textContent = this.options.type === 'avatar' ? 
                '{{adjust_square_area_avatar}}' : 
                '{{adjust_rectangular_area_background}}';
            
            this.imageContainer = document.createElement('div');
            this.imageContainer.className = 'quelora-cropper-image-container';
            
            this.image = document.createElement('img');
            this.image.className = 'quelora-cropper-image';
            this.image.src = this.options.imageSrc;
            
            this.selection = document.createElement('div');
            this.selection.className = `quelora-cropper-selection quelora-cropper-selection-${this.options.type}`;
            
            this.selection.innerHTML = `
                <div class="quelora-cropper-handle tl" data-direction="nw"></div>
                <div class="quelora-cropper-handle tr" data-direction="ne"></div>
                <div class="quelora-cropper-handle bl" data-direction="sw"></div>
                <div class="quelora-cropper-handle br" data-direction="se"></div>
            `;
            
            const buttons = document.createElement('div');
            buttons.className = 'quelora-cropper-buttons';
            
            this.cancelBtn = document.createElement('button');
            this.cancelBtn.className = 'quelora-cropper-button quelora-cropper-button-secondary t';
            this.cancelBtn.textContent = '{{cancel}}';
            
            this.confirmBtn = document.createElement('button');
            this.confirmBtn.className = 'quelora-cropper-button quelora-cropper-button-primary t';
            this.confirmBtn.textContent = '{{confirm}}';
            
            buttons.appendChild(this.cancelBtn);
            buttons.appendChild(this.confirmBtn);
            
            this.imageContainer.appendChild(this.image);
            this.imageContainer.appendChild(this.selection);
            
            container.appendChild(instructions);
            container.appendChild(this.imageContainer);
            
            this.modal.appendChild(container);
            this.modal.appendChild(buttons);
            
            document.body.appendChild(this.modal);
            document.body.style.overflow = 'hidden';
            
            this.setupInitialSelection();
        }
        
        setupInitialSelection() {
            this.image.onload = () => {
                const containerRect = this.imageContainer.getBoundingClientRect();
                const imgRect = this.image.getBoundingClientRect();
                const scaleX = this.image.naturalWidth / imgRect.width;
                const scaleY = this.image.naturalHeight / imgRect.height;

                let selectionWidth, selectionHeight;
                if (this.options.type === 'avatar') {
                    const size = Math.min(this.image.naturalWidth, this.image.naturalHeight, containerRect.width * 0.6 * scaleX);
                    selectionWidth = size;
                    selectionHeight = size;
                } else {
                    selectionWidth = Math.min(this.image.naturalWidth, containerRect.width * 0.8 * scaleX);
                    selectionHeight = selectionWidth / 3.57;
                    if (selectionHeight > this.image.naturalHeight) {
                        selectionHeight = this.image.naturalHeight;
                        selectionWidth = selectionHeight * 3.57;
                    }
                }

                const imgOffsetX = (containerRect.width - imgRect.width) / 2;
                const imgOffsetY = (containerRect.height - imgRect.height) / 2;
                const left = (this.image.naturalWidth - selectionWidth) / 2;
                const top = (this.image.naturalHeight - selectionHeight) / 2;

                this.selection.style.width = `${selectionWidth / scaleX}px`;
                this.selection.style.height = `${selectionHeight / scaleY}px`;
                this.selection.style.left = `${imgOffsetX + (left / scaleX)}px`;
                this.selection.style.top = `${imgOffsetY + (top / scaleY)}px`;

                this.imgWidth = this.image.naturalWidth;
                this.imgHeight = this.image.naturalHeight;
                this.currentSelection = {
                    x: left,
                    y: top,
                    width: selectionWidth,
                    height: selectionHeight
                };
                this.imgOffsetX = imgOffsetX;
                this.imgOffsetY = imgOffsetY;
                this.scaleX = scaleX;
                this.scaleY = scaleY;
            };
        }
        
        setupEventListeners() {
            this.selection.addEventListener('mousedown', this.handleSelectionStart.bind(this));
            this.selection.addEventListener('touchstart', this.handleSelectionStart.bind(this), { passive: false });
            
            this.selection.querySelectorAll('.quelora-cropper-handle').forEach(handle => {
                handle.addEventListener('mousedown', (e) => {
                    e.stopPropagation();
                    this.handleResizeStart(e, handle.dataset.direction);
                });
                handle.addEventListener('touchstart', (e) => {
                    e.stopPropagation();
                    this.handleResizeStart(e, handle.dataset.direction);
                }, { passive: false });
            });
            
            document.addEventListener('mousemove', this.handleMove.bind(this));
            document.addEventListener('touchmove', this.handleMove.bind(this), { passive: false });
            document.addEventListener('mouseup', this.handleEnd.bind(this));
            document.addEventListener('touchend', this.handleEnd.bind(this));
            
            this.cancelBtn.addEventListener('click', () => {
                this.destroy();
                this.options.onCancel();
            });
            
            this.confirmBtn.addEventListener('click', () => {
                const result = this.cropImage();
                this.destroy();
                this.options.onConfirm(result);
            });
        }
                
        handleSelectionStart(e) {
            e.preventDefault();
            this.isDragging = true;
            this.resizeDirection = null;
            
            const clientX = e.clientX || e.touches[0].clientX;
            const clientY = e.clientY || e.touches[0].clientY;
            
            this.dragStartX = clientX;
            this.dragStartY = clientY;
            
            const rect = this.selection.getBoundingClientRect();
            this.selectionStartX = rect.left;
            this.selectionStartY = rect.top;
        }
        
        handleMove(e) {
            if (!this.isDragging) return;
            e.preventDefault();
            
            const clientX = e.clientX || (e.changedTouches && e.changedTouches[0].clientX);
            const clientY = e.clientY || (e.changedTouches && e.changedTouches[0].clientY);
            
            const deltaX = clientX - this.dragStartX;
            const deltaY = clientY - this.dragStartY;
            
            if (this.resizeDirection) {
                this.handleResize(deltaX, deltaY);
            } else {
                this.handleDrag(deltaX, deltaY);
            }
        }
        
        handleDrag(deltaX, deltaY) {
            const containerRect = this.imageContainer.getBoundingClientRect();
            const imgRect = this.image.getBoundingClientRect();
            const scaleX = this.scaleX;
            const scaleY = this.scaleY;
            
            let newX = ((this.selectionStartX - containerRect.left - this.imgOffsetX) + deltaX) * scaleX;
            let newY = ((this.selectionStartY - containerRect.top - this.imgOffsetY) + deltaY) * scaleY;
            
            const maxX = this.imgWidth - this.currentSelection.width;
            const maxY = this.imgHeight - this.currentSelection.height;
            
            this.currentSelection.x = Math.max(0, Math.min(newX, maxX));
            this.currentSelection.y = Math.max(0, Math.min(newY, maxY));
            
            this.selection.style.left = `${this.imgOffsetX + (this.currentSelection.x / scaleX)}px`;
            this.selection.style.top = `${this.imgOffsetY + (this.currentSelection.y / scaleY)}px`;
        }
        
        handleResizeStart(e, direction) {
            e.preventDefault();
            this.isDragging = true;
            this.resizeDirection = direction;

            const clientX = e.clientX || e.touches[0].clientX;
            const clientY = e.clientY || e.touches[0].clientY;

            this.dragStartX = clientX;
            this.dragStartY = clientY;

            this.selectionStartX_img = this.currentSelection.x;
            this.selectionStartY_img = this.currentSelection.y;
            this.selectionStartWidth = this.currentSelection.width;
            this.selectionStartHeight = this.currentSelection.height;
        }

        handleResize(deltaX, deltaY) {
            const scaleX = this.scaleX;
            const aspectRatio = this.options.type === 'avatar' ? 1 : 4.3;
            const minSize = 90;

            const adjustedDeltaX = deltaX * scaleX;
            const adjustedDeltaY = deltaY * this.scaleY;

            let newX = this.selectionStartX_img;
            let newY = this.selectionStartY_img;
            let newWidth = this.selectionStartWidth;
            let newHeight = this.selectionStartHeight;

            switch (this.resizeDirection) {
                case 'se':
                    newWidth = this.selectionStartWidth + adjustedDeltaX;
                    break;
                case 'sw':
                    newWidth = this.selectionStartWidth - adjustedDeltaX;
                    newX = this.selectionStartX_img + adjustedDeltaX;
                    break;
                case 'ne':
                    newWidth = this.selectionStartWidth + adjustedDeltaX;
                    break;
                case 'nw':
                    newWidth = this.selectionStartWidth - adjustedDeltaX;
                    newX = this.selectionStartX_img + adjustedDeltaX;
                    break;
            }

            newWidth = Math.max(minSize, newWidth);
            newHeight = newWidth / aspectRatio;

            if (this.resizeDirection === 'nw' || this.resizeDirection === 'sw') {
                newX = this.selectionStartX_img + (this.selectionStartWidth - newWidth);
            }

            if (this.resizeDirection === 'nw' || this.resizeDirection === 'ne') {
                newY = this.selectionStartY_img + (this.selectionStartHeight - newHeight);
            }

            if (newX < 0) {
                newWidth += newX;
                newX = 0;
            }
            if (newY < 0) {
                newHeight += newY;
                newY = 0;
            }
            if (newX + newWidth > this.imgWidth) {
                newWidth = this.imgWidth - newX;
            }
            if (newY + newHeight > this.imgHeight) {
                newHeight = this.imgHeight - newY;
            }

            if (this.resizeDirection.includes('w')) {
                newHeight = newWidth / aspectRatio;
            } else {
                newWidth = newHeight * aspectRatio;
            }

            this.currentSelection = { x: newX, y: newY, width: newWidth, height: newHeight };
            
            this.updateSelectionPosition();
        }

        updateSelectionPosition() {
            this.selection.style.left = `${this.imgOffsetX + (this.currentSelection.x / this.scaleX)}px`;
            this.selection.style.top = `${this.imgOffsetY + (this.currentSelection.y / this.scaleY)}px`;
            this.selection.style.width = `${this.currentSelection.width / this.scaleX}px`;
            this.selection.style.height = `${this.currentSelection.height / this.scaleY}px`;
        }

        handleEnd() {
            this.isDragging = false;
            this.resizeDirection = null;
        }
        
        cropImage() {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Set canvas to max 500x500, maintaining aspect ratio
            const maxSize = 500;
            let width = this.currentSelection.width;
            let height = this.currentSelection.height;

            if (width > maxSize || height > maxSize) {
                const scale = Math.min(maxSize / width, maxSize / height);
                width = width * scale;
                height = height * scale;
            }

            canvas.width = width;
            canvas.height = height;
            
            ctx.drawImage(
                this.image,
                this.currentSelection.x,
                this.currentSelection.y,
                this.currentSelection.width,
                this.currentSelection.height,
                0,
                0,
                width,
                height
            );
            
            return canvas.toDataURL('image/jpeg', 0.8);
        }
        
        destroy() {
            document.removeEventListener('mousemove', this.handleMove);
            document.removeEventListener('touchmove', this.handleMove);
            document.removeEventListener('mouseup', this.handleEnd);
            document.removeEventListener('touchend', this.handleEnd);
            this.image.onload = null;
            document.body.style.overflow = '';
            this.modal.remove();
        }
    }

    return {
        create: function(options) {
            return new Cropper(options);
        }
    };
})();

export default ImageCropper;