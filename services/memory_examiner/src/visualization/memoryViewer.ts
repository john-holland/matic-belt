/// <reference lib="dom" />
import { MemoryRegion, MemoryPattern, Anomaly } from '../types';
import { QuadTree, QuadTreeNode } from '../quadTree';

export class MemoryViewer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private quadTree: QuadTree;
  private width: number;
  private height: number;
  private scale: number;
  private offsetX: number;
  private offsetY: number;
  private isDragging: boolean;
  private lastX: number;
  private lastY: number;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.quadTree = new QuadTree();
    this.width = canvas.width;
    this.height = canvas.height;
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this.isDragging = false;
    this.lastX = 0;
    this.lastY = 0;

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.canvas.addEventListener('mousedown', (e: MouseEvent) => {
      this.isDragging = true;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
    });

    this.canvas.addEventListener('mousemove', (e: MouseEvent) => {
      if (this.isDragging) {
        const dx = e.clientX - this.lastX;
        const dy = e.clientY - this.lastY;
        this.offsetX += dx;
        this.offsetY += dy;
        this.lastX = e.clientX;
        this.lastY = e.clientY;
        this.render();
      }
    });

    this.canvas.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    this.canvas.addEventListener('wheel', (e: WheelEvent) => {
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      this.scale *= delta;
      this.scale = Math.max(0.1, Math.min(10, this.scale));
      this.render();
    });
  }

  public update(regions: MemoryRegion[], patterns: MemoryPattern[], anomalies: Anomaly[]): void {
    this.quadTree.update(regions);
    this.render();
  }

  private render(): void {
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.ctx.save();
    this.ctx.translate(this.offsetX, this.offsetY);
    this.ctx.scale(this.scale, this.scale);

    // Draw memory regions
    this.quadTree.getState().forEach((node: QuadTreeNode) => {
      if (node.data) {
        this.ctx.fillStyle = this.getRegionColor(node.data.type);
        this.ctx.fillRect(
          node.bounds.x * this.width,
          node.bounds.y * this.height,
          node.bounds.width * this.width,
          node.bounds.height * this.height
        );
      }
    });

    // Draw grid
    this.ctx.strokeStyle = '#ccc';
    this.ctx.lineWidth = 0.5 / this.scale;
    for (let x = 0; x < this.width; x += 100) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.height);
      this.ctx.stroke();
    }
    for (let y = 0; y < this.height; y += 100) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.width, y);
      this.ctx.stroke();
    }

    this.ctx.restore();
  }

  private getRegionColor(type: string): string {
    switch (type) {
      case 'code':
        return 'rgba(0, 255, 0, 0.3)';
      case 'data':
        return 'rgba(0, 0, 255, 0.3)';
      case 'heap':
        return 'rgba(255, 0, 0, 0.3)';
      case 'stack':
        return 'rgba(255, 255, 0, 0.3)';
      default:
        return 'rgba(128, 128, 128, 0.3)';
    }
  }
} 