import sharp from 'sharp';

export interface ImageProcessingOptions {
  title?: string;
  titlePosition?: 'top' | 'bottom';
  backgroundColor?: string;
  titleColor?: string;
  fontSize?: number;
  fontFamily?: string;
}

export interface ProcessedImageResult {
  buffer: Buffer;
  width: number;
  height: number;
  originalDimensions: { width: number; height: number };
}

export class ImageProcessor {
  private static readonly TARGET_ASPECT_RATIO = 4 / 3;
  private static readonly DEFAULT_WIDTH = 1200;
  private static readonly DEFAULT_HEIGHT = 900;

  /**
   * Process an image to 4:3 aspect ratio with optional title overlay
   */
  static async processImageFor43AspectRatio(
    imageBuffer: Buffer,
    options: ImageProcessingOptions = {}
  ): Promise<ProcessedImageResult> {
    try {
      // Get original image metadata
      const metadata = await sharp(imageBuffer).metadata();
      const originalWidth = metadata.width || 0;
      const originalHeight = metadata.height || 0;

      if (originalWidth === 0 || originalHeight === 0) {
        throw new Error('Invalid image dimensions');
      }

      const originalAspectRatio = originalWidth / originalHeight;
      const targetWidth = this.DEFAULT_WIDTH;
      const targetHeight = this.DEFAULT_HEIGHT;

      let processedBuffer: Buffer;

      if (Math.abs(originalAspectRatio - this.TARGET_ASPECT_RATIO) < 0.01) {
        // Image is already close to 4:3, just resize
        processedBuffer = await sharp(imageBuffer)
          .resize(targetWidth, targetHeight, { fit: 'fill' })
          .jpeg({ quality: 90 })
          .toBuffer();
      } else {
        // Need to add black bars (letterboxing)
        let resizeWidth: number;
        let resizeHeight: number;

        if (originalAspectRatio > this.TARGET_ASPECT_RATIO) {
          // Image is wider than 4:3, add black bars on top and bottom
          resizeWidth = targetWidth;
          resizeHeight = Math.round(targetWidth / originalAspectRatio);
        } else {
          // Image is taller than 4:3, add black bars on left and right
          resizeHeight = targetHeight;
          resizeWidth = Math.round(targetHeight * originalAspectRatio);
        }

        // Resize the image
        const resizedBuffer = await sharp(imageBuffer)
          .resize(resizeWidth, resizeHeight, { fit: 'fill' })
          .jpeg({ quality: 90 })
          .toBuffer();

        // Create a black background and composite the resized image
        processedBuffer = await sharp({
          create: {
            width: targetWidth,
            height: targetHeight,
            channels: 3,
            background: { r: 0, g: 0, b: 0 }
          }
        })
        .composite([{
          input: resizedBuffer,
          left: Math.round((targetWidth - resizeWidth) / 2),
          top: Math.round((targetHeight - resizeHeight) / 2)
        }])
        .jpeg({ quality: 90 })
        .toBuffer();
      }

      // Add title overlay if provided
      if (options.title) {
        processedBuffer = await this.addTitleOverlay(processedBuffer, options);
      }

      return {
        buffer: processedBuffer,
        width: targetWidth,
        height: targetHeight,
        originalDimensions: { width: originalWidth, height: originalHeight }
      };
    } catch (error) {
      console.error('Error processing image:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Image processing failed: ${errorMessage}`);
    }
  }

  /**
   * Add title overlay to an image using canvas
   */
  private static async addTitleOverlay(
    imageBuffer: Buffer,
    options: ImageProcessingOptions
  ): Promise<Buffer> {
    try {
      // Dynamic import for canvas to handle ES modules
      const { createCanvas, loadImage } = await import('canvas');
      
      const {
        title = '',
        titlePosition = 'bottom',
        backgroundColor = '#000000',
        titleColor = '#ffffff',
        fontSize = 48,
        fontFamily = 'Arial'
      } = options;

      // Load the image
      const image = await loadImage(imageBuffer);
      const canvas = createCanvas(image.width, image.height);
      const ctx = canvas.getContext('2d');

      // Draw the original image
      ctx.drawImage(image, 0, 0);

      // Set up text properties
      ctx.font = `${fontSize}px ${fontFamily}`;
      ctx.fillStyle = titleColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Calculate text area
      const maxWidth = image.width * 0.9; // 90% of image width
      const words = title.split(' ');
      const lines: string[] = [];
      let currentLine = '';

      // Word wrap
      for (const word of words) {
        const testLine = currentLine + (currentLine ? ' ' : '') + word;
        const metrics = ctx.measureText(testLine);
        
        if (metrics.width > maxWidth && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) {
        lines.push(currentLine);
      }

      // Calculate text area height
      const lineHeight = fontSize * 1.2;
      const textAreaHeight = lines.length * lineHeight;
      const padding = 20;

      // Determine text position
      let textY: number;
      let backgroundY: number;
      let backgroundHeight: number;

      if (titlePosition === 'top') {
        textY = padding + textAreaHeight / 2;
        backgroundY = 0;
        backgroundHeight = textAreaHeight + padding * 2;
      } else {
        textY = image.height - padding - textAreaHeight / 2;
        backgroundY = image.height - textAreaHeight - padding * 2;
        backgroundHeight = textAreaHeight + padding * 2;
      }

      // Draw background rectangle
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, backgroundY, image.width, backgroundHeight);

      // Draw text lines
      ctx.fillStyle = titleColor;
      lines.forEach((line, index) => {
        const lineY = textY - (lines.length - 1) * lineHeight / 2 + index * lineHeight;
        ctx.fillText(line, image.width / 2, lineY);
      });

      // Convert canvas to buffer
      return canvas.toBuffer('image/jpeg', { quality: 0.9 });
    } catch (error) {
      console.error('Error adding title overlay:', error);
      // If canvas fails, return the original image
      return imageBuffer;
    }
  }

  /**
   * Validate if a buffer contains a valid image
   */
  static async validateImage(buffer: Buffer): Promise<boolean> {
    try {
      const metadata = await sharp(buffer).metadata();
      return !!(metadata.width && metadata.height);
    } catch {
      return false;
    }
  }

  /**
   * Get image metadata
   */
  static async getImageMetadata(buffer: Buffer): Promise<{
    width: number;
    height: number;
    format?: string;
    size: number;
  }> {
    const metadata = await sharp(buffer).metadata();
    return {
      width: metadata.width || 0,
      height: metadata.height || 0,
      format: metadata.format,
      size: buffer.length
    };
  }
}