class_name ArenaGrid
extends Node2D

const EMPTY := 0
const HARD_FIREWALL := 1
const SOFT_FIREWALL := 2
const UNSTABLE := 3
const GATEWAY := 4

var width := 19
var height := 11
var tile_size := 52.0
var sector_seed := 7331
var origin := Vector2(146.0, 88.0)
var cells: Array = []
var temp_firewalls: Dictionary = {}
var temp_firewall_owner: Dictionary = {}
var streams: Dictionary = {}
var gateways: Dictionary = {}
var player_spawns: Array[Vector2i] = [Vector2i(2, 2), Vector2i(16, 8)]
var rng := RandomNumberGenerator.new()
var glitch_time := 0.0

func _process(delta: float) -> void:
	glitch_time += delta
	_tick_temp_firewalls(delta)
	queue_redraw()

func generate() -> void:
	rng.seed = sector_seed
	cells.clear()
	temp_firewalls.clear()
	temp_firewall_owner.clear()
	streams.clear()
	gateways.clear()

	for y in range(height):
		var row: Array[int] = []
		for x in range(width):
			var cell := Vector2i(x, y)
			if x == 0 or y == 0 or x == width - 1 or y == height - 1:
				row.append(HARD_FIREWALL)
			elif _is_spawn_safe(cell):
				row.append(EMPTY)
			else:
				var roll := rng.randf()
				if roll < 0.10:
					row.append(HARD_FIREWALL)
				elif roll < 0.28:
					row.append(SOFT_FIREWALL)
				elif roll < 0.36:
					row.append(UNSTABLE)
				else:
					row.append(EMPTY)
		cells.append(row)

	_carve_main_routes()
	_place_gateways()
	_place_streams()
	queue_redraw()

func _draw() -> void:
	for y in range(height):
		for x in range(width):
			var cell := Vector2i(x, y)
			var center := cell_to_world(cell)
			var rect := Rect2(center - Vector2.ONE * tile_size * 0.5, Vector2.ONE * tile_size)
			_draw_cell_base(rect, cell)
			_draw_cell_contents(rect, cell)

	for from_cell in streams.keys():
		var to_cell: Vector2i = streams[from_cell]
		_draw_stream(from_cell, to_cell)

	for from_cell in gateways.keys():
		var to_cell: Vector2i = gateways[from_cell]
		if _cell_sort_key(from_cell) < _cell_sort_key(to_cell):
			_draw_gateway_link(from_cell, to_cell)

func _draw_cell_base(rect: Rect2, cell: Vector2i) -> void:
	var even := (cell.x + cell.y) % 2 == 0
	var fill := Color(0.018, 0.024, 0.04) if even else Color(0.014, 0.018, 0.032)
	draw_rect(rect.grow(-1.5), fill, true)
	draw_rect(rect.grow(-1.5), Color(0.0, 0.85, 1.0, 0.055), false, 1.0)

func _draw_cell_contents(rect: Rect2, cell: Vector2i) -> void:
	if temp_firewalls.has(cell):
		_draw_temp_firewall(rect, temp_firewall_owner.get(cell, 0))
		return

	match get_cell(cell):
		HARD_FIREWALL:
			var points := PackedVector2Array([
				rect.position + Vector2(6, 8),
				rect.position + Vector2(rect.size.x - 7, 4),
				rect.position + Vector2(rect.size.x - 5, rect.size.y - 10),
				rect.position + Vector2(8, rect.size.y - 5)
			])
			draw_colored_polygon(points, Color(0.05, 0.065, 0.095))
			points.append(points[0])
			draw_polyline(points, Color(0.0, 0.92, 1.0, 0.34), 1.6)
		SOFT_FIREWALL:
			var inset := rect.grow(-8.0)
			draw_rect(inset, Color(0.18, 0.04, 0.13, 0.82), true)
			draw_line(inset.position, inset.end, Color(1.0, 0.08, 0.58, 0.72), 2.0)
			draw_line(Vector2(inset.end.x, inset.position.y), Vector2(inset.position.x, inset.end.y), Color(1.0, 0.08, 0.58, 0.44), 1.0)
		UNSTABLE:
			var center := rect.get_center()
			var radius := tile_size * (0.18 + 0.025 * sin(glitch_time * 5.0 + float(cell.x)))
			draw_circle(center, radius, Color(0.72, 0.18, 1.0, 0.16))
			draw_arc(center, radius + 6.0, 0.4, 5.4, 10, Color(0.72, 0.18, 1.0, 0.55), 1.4)
		GATEWAY:
			var center := rect.get_center()
			draw_arc(center, 16.0, glitch_time * 2.0, TAU + glitch_time * 2.0 - 0.6, 24, Color(0.0, 0.95, 1.0, 0.7), 2.0)
			draw_arc(center, 22.0, -glitch_time * 1.5, TAU - glitch_time * 1.5 - 1.2, 24, Color(1.0, 0.08, 0.58, 0.55), 1.6)

func _draw_temp_firewall(rect: Rect2, owner_id: int) -> void:
	var color := Color(0.0, 0.95, 1.0, 0.78) if owner_id == 1 else Color(1.0, 0.08, 0.58, 0.78)
	var inset := rect.grow(-5.0)
	draw_rect(inset, Color(color.r, color.g, color.b, 0.14), true)
	for i in range(4):
		var x := inset.position.x + 8.0 + float(i) * 10.0
		draw_line(Vector2(x, inset.position.y + 4.0), Vector2(x + 9.0, inset.end.y - 4.0), color, 2.0)

func _draw_stream(from_cell: Vector2i, to_cell: Vector2i) -> void:
	var a := cell_to_world(from_cell)
	var b := cell_to_world(to_cell)
	var dir := (b - a).normalized()
	var side := Vector2(-dir.y, dir.x)
	draw_line(a - dir * 13.0, b + dir * 13.0, Color(0.0, 0.85, 1.0, 0.18), 5.0)
	for i in range(3):
		var t := fmod(glitch_time * 1.6 + float(i) * 0.33, 1.0)
		var p := a.lerp(b, t)
		var arrow := PackedVector2Array([
			p + dir * 10.0,
			p - dir * 7.0 + side * 5.0,
			p - dir * 7.0 - side * 5.0
		])
		draw_colored_polygon(arrow, Color(0.0, 0.95, 1.0, 0.48))

func _draw_gateway_link(from_cell: Vector2i, to_cell: Vector2i) -> void:
	draw_dashed_line(cell_to_world(from_cell), cell_to_world(to_cell), Color(0.78, 0.18, 1.0, 0.16), 2.0, 12.0)

func cell_to_world(cell: Vector2i) -> Vector2:
	return origin + Vector2(float(cell.x) + 0.5, float(cell.y) + 0.5) * tile_size

func world_to_cell(world_position: Vector2) -> Vector2i:
	var local := (world_position - origin) / tile_size
	return Vector2i(floori(local.x), floori(local.y))

func in_bounds(cell: Vector2i) -> bool:
	return cell.x >= 0 and cell.y >= 0 and cell.x < width and cell.y < height

func get_cell(cell: Vector2i) -> int:
	if not in_bounds(cell):
		return HARD_FIREWALL
	return cells[cell.y][cell.x]

func set_cell(cell: Vector2i, value: int) -> void:
	if in_bounds(cell):
		cells[cell.y][cell.x] = value
		queue_redraw()

func is_walkable(cell: Vector2i) -> bool:
	if not in_bounds(cell) or temp_firewalls.has(cell):
		return false
	var value := get_cell(cell)
	return value == EMPTY or value == UNSTABLE or value == GATEWAY

func is_propagable(cell: Vector2i) -> bool:
	if not in_bounds(cell):
		return false
	if temp_firewalls.has(cell):
		return false
	return get_cell(cell) != HARD_FIREWALL

func can_place_node(cell: Vector2i) -> bool:
	return is_walkable(cell)

func can_place_temp_firewall(cell: Vector2i) -> bool:
	if not in_bounds(cell):
		return false
	if not is_walkable(cell):
		return false
	return get_cell(cell) == EMPTY or get_cell(cell) == UNSTABLE

func set_temp_firewall(cell: Vector2i, owner_id: int, duration: float) -> void:
	temp_firewalls[cell] = duration
	temp_firewall_owner[cell] = owner_id
	queue_redraw()

func damage_soft_firewall(cell: Vector2i) -> bool:
	if get_cell(cell) == SOFT_FIREWALL:
		set_cell(cell, EMPTY)
		return true
	return false

func is_unstable(cell: Vector2i) -> bool:
	return get_cell(cell) == UNSTABLE

func get_network_neighbors(cell: Vector2i) -> Array[Vector2i]:
	var result: Array[Vector2i] = []
	var directions := [Vector2i.RIGHT, Vector2i.LEFT, Vector2i.DOWN, Vector2i.UP]
	for dir in directions:
		var next_cell := cell + dir
		if is_propagable(next_cell):
			result.append(next_cell)

	if streams.has(cell):
		var stream_target: Vector2i = streams[cell]
		if is_propagable(stream_target):
			result.append(stream_target)

	if gateways.has(cell):
		var gateway_target: Vector2i = gateways[cell]
		if is_propagable(gateway_target):
			result.append(gateway_target)

	if is_unstable(cell):
		var diagonals := [
			Vector2i(1, 1),
			Vector2i(1, -1),
			Vector2i(-1, 1),
			Vector2i(-1, -1)
		]
		for diag in diagonals:
			var next_diag := cell + diag
			if is_propagable(next_diag) and _unstable_branch_is_open(cell, diag):
				result.append(next_diag)

	return result

func get_random_walkable_cell() -> Vector2i:
	for attempt in range(128):
		var cell := Vector2i(rng.randi_range(1, width - 2), rng.randi_range(1, height - 2))
		if is_walkable(cell):
			return cell
	return player_spawns[0]

func _tick_temp_firewalls(delta: float) -> void:
	var expired: Array[Vector2i] = []
	for cell in temp_firewalls.keys():
		temp_firewalls[cell] = float(temp_firewalls[cell]) - delta
		if temp_firewalls[cell] <= 0.0:
			expired.append(cell)
	for cell in expired:
		temp_firewalls.erase(cell)
		temp_firewall_owner.erase(cell)

func _is_spawn_safe(cell: Vector2i) -> bool:
	for spawn in player_spawns:
		if abs(cell.x - spawn.x) + abs(cell.y - spawn.y) <= 2:
			return true
	return false

func _carve_main_routes() -> void:
	var route_y := int(height / 2)
	var route_x := int(width / 2)
	for x in range(1, width - 1):
		if rng.randf() < 0.82:
			set_cell(Vector2i(x, route_y), EMPTY)
	for y in range(1, height - 1):
		if rng.randf() < 0.72:
			set_cell(Vector2i(route_x, y), EMPTY)

	for spawn in player_spawns:
		for y in range(spawn.y - 1, spawn.y + 2):
			for x in range(spawn.x - 1, spawn.x + 2):
				set_cell(Vector2i(x, y), EMPTY)

func _place_gateways() -> void:
	var a := Vector2i(3, height - 3)
	var b := Vector2i(width - 4, 2)
	set_cell(a, GATEWAY)
	set_cell(b, GATEWAY)
	gateways[a] = b
	gateways[b] = a

func _place_streams() -> void:
	for y in [3, height - 4]:
		for x in range(2, width - 3):
			var from_cell := Vector2i(x, y)
			var to_cell := Vector2i(x + 1, y)
			if is_propagable(from_cell) and is_propagable(to_cell) and rng.randf() < 0.44:
				streams[from_cell] = to_cell

	for x in [6, width - 7]:
		for y in range(2, height - 3):
			var from_cell := Vector2i(x, y)
			var to_cell := Vector2i(x, y + 1)
			if is_propagable(from_cell) and is_propagable(to_cell) and rng.randf() < 0.30:
				streams[from_cell] = to_cell

func _cell_sort_key(cell: Vector2i) -> int:
	return cell.y * width + cell.x

func _unstable_branch_is_open(cell: Vector2i, direction: Vector2i) -> bool:
	var hash := int(sector_seed) + cell.x * 92821 + cell.y * 68917 + direction.x * 193 + direction.y * 389
	hash = abs(hash * 1103515245 + 12345)
	return hash % 100 < 52
