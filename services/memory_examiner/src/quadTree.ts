import { MemoryRegion } from './types';

export interface QuadTreeNode {
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  data?: MemoryRegion;
  children?: QuadTreeNode[];
  level: number;
}

export class QuadTree {
  private root: QuadTreeNode;
  private maxLevel: number;
  private maxItems: number;

  constructor(maxLevel: number = 8, maxItems: number = 4) {
    this.maxLevel = maxLevel;
    this.maxItems = maxItems;
    this.root = {
      bounds: { x: 0, y: 0, width: 1, height: 1 },
      level: 0
    };
  }

  public update(memoryInfo: MemoryRegion[]): void {
    this.clear();
    const normalizedData = this.normalizeMemoryData(memoryInfo);
    normalizedData.forEach(region => this.insert(this.root, region));
  }

  private clear(): void {
    this.root = {
      bounds: { x: 0, y: 0, width: 1, height: 1 },
      level: 0
    };
  }

  private normalizeMemoryData(memoryInfo: MemoryRegion[]): MemoryRegion[] {
    const maxAddress = Math.max(...memoryInfo.map(region => region.address + region.size));
    return memoryInfo.map(region => ({
      ...region,
      normalizedAddress: region.address / maxAddress,
      normalizedSize: region.size / maxAddress
    }));
  }

  private insert(node: QuadTreeNode, region: MemoryRegion): void {
    if (!node.children) {
      if (!node.data) {
        node.data = region;
        return;
      }

      if (node.level >= this.maxLevel) {
        return;
      }

      this.split(node);
    }

    const child = this.getChildForRegion(node, region);
    if (child) {
      this.insert(child, region);
    }
  }

  private split(node: QuadTreeNode): void {
    const { x, y, width, height } = node.bounds;
    const halfWidth = width / 2;
    const halfHeight = height / 2;

    node.children = [
      {
        bounds: { x, y, width: halfWidth, height: halfHeight },
        level: node.level + 1
      },
      {
        bounds: { x: x + halfWidth, y, width: halfWidth, height: halfHeight },
        level: node.level + 1
      },
      {
        bounds: { x, y: y + halfHeight, width: halfWidth, height: halfHeight },
        level: node.level + 1
      },
      {
        bounds: { x: x + halfWidth, y: y + halfHeight, width: halfWidth, height: halfHeight },
        level: node.level + 1
      }
    ];

    if (node.data) {
      const child = this.getChildForRegion(node, node.data);
      if (child) {
        this.insert(child, node.data);
      }
      delete node.data;
    }
  }

  private getChildForRegion(node: QuadTreeNode, region: MemoryRegion): QuadTreeNode | undefined {
    if (!node.children) return undefined;

    const { normalizedAddress, normalizedSize } = region;
    if (typeof normalizedAddress !== 'number' || typeof normalizedSize !== 'number') {
      return undefined;
    }

    const { x, y, width, height } = node.bounds;
    const halfWidth = width / 2;
    const halfHeight = height / 2;

    if (normalizedAddress < x + halfWidth) {
      if (normalizedAddress + normalizedSize < x + halfWidth) {
        return node.children[0];
      }
      if (normalizedAddress < x + halfWidth && normalizedAddress + normalizedSize > x + halfWidth) {
        return undefined;
      }
    }

    if (normalizedAddress >= x + halfWidth) {
      if (normalizedAddress + normalizedSize <= x + width) {
        return node.children[1];
      }
      if (normalizedAddress < x + width && normalizedAddress + normalizedSize > x + width) {
        return undefined;
      }
    }

    if (normalizedAddress < x + halfWidth) {
      if (normalizedAddress + normalizedSize < x + halfWidth) {
        return node.children[2];
      }
      if (normalizedAddress < x + halfWidth && normalizedAddress + normalizedSize > x + halfWidth) {
        return undefined;
      }
    }

    if (normalizedAddress >= x + halfWidth) {
      if (normalizedAddress + normalizedSize <= x + width) {
        return node.children[3];
      }
      if (normalizedAddress < x + width && normalizedAddress + normalizedSize > x + width) {
        return undefined;
      }
    }

    return undefined;
  }

  public query(region: { x: number; y: number; width: number; height: number }): MemoryRegion[] {
    const results: MemoryRegion[] = [];
    this.queryNode(this.root, region, results);
    return results;
  }

  private queryNode(node: QuadTreeNode, region: { x: number; y: number; width: number; height: number }, results: MemoryRegion[]): void {
    if (!this.intersects(node.bounds, region)) {
      return;
    }

    if (node.data) {
      results.push(node.data);
    }

    if (node.children) {
      node.children.forEach(child => this.queryNode(child, region, results));
    }
  }

  private intersects(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }): boolean {
    return !(
      a.x + a.width < b.x ||
      a.x > b.x + b.width ||
      a.y + a.height < b.y ||
      a.y > b.y + b.height
    );
  }

  public getState(): QuadTreeNode[] {
    const nodes: QuadTreeNode[] = [];
    this.getNodeState(this.root, nodes);
    return nodes;
  }

  private getNodeState(node: QuadTreeNode, nodes: QuadTreeNode[]): void {
    nodes.push(node);
    if (node.children) {
      node.children.forEach(child => this.getNodeState(child, nodes));
    }
  }
} 