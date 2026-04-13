/**
 * Aho-Corasick 自动机
 * 用于高效多模式字符串匹配（内容过滤等场景）
 */

interface ACNode {
  children: Map<string, ACNode>
  fail: ACNode | null
  output: Set<string>
  isEnd: boolean
}

function createNode(): ACNode {
  return { children: new Map(), fail: null, output: new Set(), isEnd: false }
}

export class ACAutomaton {
  private root: ACNode = createNode()
  private built = false
  private readonly caseSensitive: boolean

  constructor(caseSensitive = false) {
    this.caseSensitive = caseSensitive
  }

  addKeyword(keyword: string): void {
    if (!keyword) return
    const word = this.caseSensitive ? keyword : keyword.toLowerCase()
    let node = this.root
    for (const ch of word) {
      if (!node.children.has(ch)) node.children.set(ch, createNode())
      node = node.children.get(ch)!
    }
    node.isEnd = true
    node.output.add(word)
    this.built = false
  }

  addKeywords(keywords: string[]): void {
    for (const kw of keywords) this.addKeyword(kw)
  }

  /** 构建 fail 指针（BFS） */
  build(): void {
    if (this.built) return
    const queue: ACNode[] = []

    for (const child of this.root.children.values()) {
      child.fail = this.root
      queue.push(child)
    }

    let i = 0
    while (i < queue.length) {
      const node = queue[i++]
      for (const [ch, child] of node.children) {
        let fail = node.fail
        while (fail && !fail.children.has(ch)) fail = fail.fail
        child.fail = fail ? fail.children.get(ch) ?? this.root : this.root
        if (child.fail === child) child.fail = this.root
        // 合并 fail 链上的 output
        for (const kw of child.fail.output) child.output.add(kw)
        queue.push(child)
      }
    }
    this.built = true
  }

  /** 搜索文本中所有命中的关键词及其位置 */
  search(text: string): Array<{ keyword: string; position: number }> {
    this.build()
    const results: Array<{ keyword: string; position: number }> = []
    const t = this.caseSensitive ? text : text.toLowerCase()
    let node = this.root

    for (let i = 0; i < t.length; i++) {
      const ch = t[i]
      while (node !== this.root && !node.children.has(ch)) node = node.fail!
      if (node.children.has(ch)) node = node.children.get(ch)!
      for (const kw of node.output) {
        results.push({ keyword: kw, position: i - kw.length + 1 })
      }
    }
    return results
  }

  /** 返回第一个命中的关键词，没有则返回 null */
  searchFirst(text: string): string | null {
    this.build()
    const t = this.caseSensitive ? text : text.toLowerCase()
    let node = this.root

    for (const ch of t) {
      while (node !== this.root && !node.children.has(ch)) node = node.fail!
      if (node.children.has(ch)) node = node.children.get(ch)!
      if (node.output.size > 0) return node.output.values().next().value ?? null
    }
    return null
  }

  contains(text: string): boolean {
    return this.searchFirst(text) !== null
  }

  /** 将文本中的敏感词替换为 * */
  replace(text: string, replacement = '*'): string {
    this.build()
    const hits = this.search(text)
    if (!hits.length) return text

    const mask = new Array(text.length).fill(false)
    for (const { keyword, position } of hits) {
      for (let i = position; i < position + keyword.length; i++) mask[i] = true
    }
    return text.split('').map((ch, i) => (mask[i] ? replacement : ch)).join('')
  }

  getKeywordCount(): number {
    let count = 0
    const stack: ACNode[] = [this.root]
    while (stack.length) {
      const node = stack.pop()!
      if (node.isEnd) count += node.output.size
      for (const child of node.children.values()) stack.push(child)
    }
    return count
  }

  clear(): void {
    this.root = createNode()
    this.built = false
  }
}
