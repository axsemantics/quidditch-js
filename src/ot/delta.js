export default class Delta {
	constructor (ops = []) {
		this.ops = ops
	}
	
	insert (text) {
		const op = { insert: text }
		return this.push(op)
	}
	
	delete (length) {
		const op = { delete: length }
		return this.push(op)
	}
	
	retain (length) {
		const op = { retain: length }
		return this.push(op)
	}
	
	push (newOp) {
		const index = this.ops.length
		const lastOp = this.ops[index - 1]
		
		// patch lastOp if we can
		if (lastOp) {
			if (newOp.retain && lastOp.retain) {
				this.ops[index - 1] = { retain: lastOp.retain + newOp.retain }
				return this
			}
			
			if (newOp.insert && lastOp.insert) {
				this.ops[index - 1] = { insert: lastOp.insert + newOp.insert }
				return this
			}
			
			if (newOp.delete && lastOp.delete) {
				this.ops[index - 1] = { delete: lastOp.delete + newOp.delete }
				return this
			}			
		}
		this.ops.push(newOp)
		return this
	}
}
