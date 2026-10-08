class FakeClock {
  now = 0
  nextId = 1
  pending = new Map()

  setTimeout = (callback, delay = 0) => {
    const id = this.nextId++
    this.pending.set(id, { at: this.now + delay, callback })
    return id
  }

  clearTimeout = (id) => this.pending.delete(id)

  async flush() {
    for (let index = 0; index < 10; index += 1) await Promise.resolve()
  }

  async advance(ms) {
    const target = this.now + ms
    await this.flush()
    while (true) {
      const next = [...this.pending.entries()]
        .filter(([, timer]) => timer.at <= target)
        .sort((left, right) => left[1].at - right[1].at)[0]
      if (!next) break
      this.now = next[1].at
      this.pending.delete(next[0])
      next[1].callback()
      await this.flush()
    }
    this.now = target
    await this.flush()
  }
}

module.exports = { FakeClock }
