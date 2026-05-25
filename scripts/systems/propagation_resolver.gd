class_name PropagationResolver
extends Node2D

var arena: ArenaGrid
var game
var pulses: Array[Dictionary] = []
var static_bursts: Array[Dictionary] = []

func _process(delta: float) -> void:
	_tick_pulses(delta)
	_tick_static_bursts(delta)
	queue_redraw()

func _draw() -> void:
	for pulse in pulses:
		var life: float = pulse["age"] / pulse["duration"]
		var a: Vector2 = pulse["a"]
		var b: Vector2 = pulse["b"]
		var color: Color = pulse["color"]
		var head := a.lerp(b, clamp(life, 0.0, 1.0))
		draw_line(a, head, Color(color.r, color.g, color.b, 0.2), 8.0)
		draw_line(a, head, Color(color.r, color.g, color.b, 0.82), 2.2)
		draw_circle(head, 5.5 + 5.0 * (1.0 - life), Color(color.r, color.g, color.b, 0.82))

	for burst in static_bursts:
		var age: float = burst["age"]
		var duration: float = burst["duration"]
		var center: Vector2 = burst["center"]
		var color: Color = burst["color"]
		var life := age / duration
		for i in range(8):
			var angle := float(i) / 8.0 * TAU + age * 8.0
			var end := center + Vector2.RIGHT.rotated(angle) * (18.0 + 34.0 * life)
			draw_line(center, end, Color(color.r, color.g, color.b, 0.5 * (1.0 - life)), 1.5)

func propagate_from(source: InfectionNode, origin_cell: Vector2i, radius: int, color: Color) -> void:
	var frontier: Array[Vector2i] = [origin_cell]
	var came_from: Dictionary = {}
	var depth: Dictionary = {}
	var order: Array[Vector2i] = [origin_cell]
	came_from[origin_cell] = origin_cell
	depth[origin_cell] = 0

	while not frontier.is_empty():
		var current: Vector2i = frontier.pop_front()
		var current_depth: int = depth[current]
		if current_depth >= radius:
			continue

		for next_cell in arena.get_network_neighbors(current):
			if came_from.has(next_cell):
				continue
			if arena.get_cell(next_cell) == ArenaGrid.SOFT_FIREWALL:
				came_from[next_cell] = current
				depth[next_cell] = current_depth + 1
				order.append(next_cell)
				continue
			came_from[next_cell] = current
			depth[next_cell] = current_depth + 1
			frontier.append(next_cell)
			order.append(next_cell)

	for cell in order:
		var d: int = depth[cell]
		var parent: Vector2i = came_from[cell]
		if cell != origin_cell:
			_add_pulse(parent, cell, d, color)
		var delay := 0.07 * float(d)
		var timer := get_tree().create_timer(delay)
		timer.timeout.connect(_resolve_delayed_cell.bind(cell, source, max(0.55, 1.0 - float(d) * 0.045)))

func emit_static_burst(cell: Vector2i, _owner: PlayerAI, color: Color) -> void:
	static_bursts.append({
		"center": arena.cell_to_world(cell),
		"age": 0.0,
		"duration": 0.42,
		"color": color
	})
	var neighbors := [
		cell + Vector2i.RIGHT,
		cell + Vector2i.LEFT,
		cell + Vector2i.UP,
		cell + Vector2i.DOWN
	]
	for neighbor in neighbors:
		if arena.is_propagable(neighbor):
			var timer := get_tree().create_timer(0.09)
			timer.timeout.connect(_resolve_delayed_cell.bind(neighbor, null, 0.45))

func _resolve_delayed_cell(cell: Vector2i, source: InfectionNode, intensity: float) -> void:
	if game == null:
		return
	if source != null and not is_instance_valid(source):
		return
	game.resolve_corruption_cell(cell, source, intensity)

func _add_pulse(from_cell: Vector2i, to_cell: Vector2i, depth: int, color: Color) -> void:
	pulses.append({
		"a": arena.cell_to_world(from_cell),
		"b": arena.cell_to_world(to_cell),
		"age": 0.0,
		"duration": 0.15 + float(depth) * 0.012,
		"color": color
	})

func _tick_pulses(delta: float) -> void:
	for pulse in pulses:
		pulse["age"] += delta
	pulses = pulses.filter(func(pulse: Dictionary) -> bool:
		return pulse["age"] <= pulse["duration"]
	)

func _tick_static_bursts(delta: float) -> void:
	for burst in static_bursts:
		burst["age"] += delta
	static_bursts = static_bursts.filter(func(burst: Dictionary) -> bool:
		return burst["age"] <= burst["duration"]
	)
