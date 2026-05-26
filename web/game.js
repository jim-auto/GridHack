(() => {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  const CELL = {
    EMPTY: 0,
    HARD: 1,
    SOFT: 2,
    UNSTABLE: 3,
    GATE: 4
  };

  const keys = new Set();
  const pressed = new Set();
  const touch = {
    available: window.matchMedia("(pointer: coarse)").matches,
    joystickId: null,
    joystickBase: { x: 0, y: 0 },
    joystickKnob: { x: 0, y: 0 },
    vector: { x: 0, y: 0 },
    pointerActions: new Map(),
    deploy: false,
    wall: false,
    reset: false
  };
  let touchControls = {};
  const colors = {
    bg: "#03040a",
    panel: "rgba(8, 13, 25, 0.78)",
    cyan: "#00f2ff",
    magenta: "#ff1493",
    violet: "#b238ff",
    green: "#39ff88",
    white: "#ddebff"
  };
  const audio = createAudioSystem();

  let view = {
    w: 1280,
    h: 720,
    dpr: 1,
    tile: 52,
    ox: 146,
    oy: 88
  };

  function resize() {
    view.dpr = Math.min(window.devicePixelRatio || 1, 2);
    view.w = window.innerWidth;
    view.h = window.innerHeight;
    canvas.width = Math.floor(view.w * view.dpr);
    canvas.height = Math.floor(view.h * view.dpr);
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);

    const hudReserve = view.w < 760 ? 132 : 118;
    const touchReserve = touchControlsVisible() ? 112 : 0;
    const usableW = Math.max(320, view.w - 32);
    const usableH = Math.max(300, view.h - hudReserve - touchReserve - 16);
    view.tile = Math.max(24, Math.floor(Math.min(usableW / 19, usableH / 11)));
    view.ox = Math.floor((view.w - view.tile * 19) * 0.5);
    view.oy = Math.floor((view.w < 760 ? 126 : 98) + Math.max(0, (view.h - 720) * 0.18));
    updateTouchLayout();
  }

  window.addEventListener("resize", resize);
  resize();

  window.addEventListener("keydown", (event) => {
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) {
      event.preventDefault();
    }
    audio.unlock();
    if (!keys.has(event.code)) {
      pressed.add(event.code);
    }
    keys.add(event.code);
  });

  window.addEventListener("keyup", (event) => {
    keys.delete(event.code);
  });

  canvas.addEventListener("pointerdown", handlePointerDown);
  canvas.addEventListener("pointermove", handlePointerMove);
  canvas.addEventListener("pointerup", handlePointerEnd);
  canvas.addEventListener("pointercancel", handlePointerEnd);
  canvas.addEventListener("lostpointercapture", handlePointerEnd);

  function touchControlsVisible() {
    return touch.available || view.w < 920;
  }

  function updateTouchLayout() {
    const compact = view.w < 760;
    const bottom = Math.max(18, view.h - (compact ? 72 : 84));
    const joystickRadius = compact ? 46 : 56;
    const buttonRadius = compact ? 33 : 40;
    touchControls = {
      joystick: {
        x: compact ? 70 : 92,
        y: bottom,
        r: joystickRadius,
        knobR: compact ? 18 : 22
      },
      deploy: {
        x: view.w - (compact ? 68 : 96),
        y: bottom - (compact ? 22 : 28),
        r: buttonRadius,
        label: "NODE",
        color: colors.cyan
      },
      wall: {
        x: view.w - (compact ? 136 : 184),
        y: bottom + (compact ? 18 : 22),
        r: compact ? 29 : 35,
        label: "WALL",
        color: colors.magenta
      },
      reset: {
        x: view.w - (compact ? 66 : 92),
        y: compact ? 112 : 112,
        w: compact ? 86 : 98,
        h: 34
      }
    };

    if (touch.joystickId == null) {
      touch.joystickBase = { x: touchControls.joystick.x, y: touchControls.joystick.y };
      touch.joystickKnob = { ...touch.joystickBase };
    }
  }

  function pointerPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  }

  function pointInCircle(point, circle) {
    return Math.hypot(point.x - circle.x, point.y - circle.y) <= circle.r;
  }

  function pointInRect(point, rect) {
    return point.x >= rect.x - rect.w * 0.5 &&
      point.x <= rect.x + rect.w * 0.5 &&
      point.y >= rect.y - rect.h * 0.5 &&
      point.y <= rect.y + rect.h * 0.5;
  }

  function beginJoystick(pointerId, point) {
    touch.joystickId = pointerId;
    touch.joystickBase = { ...point };
    touch.joystickKnob = { ...point };
    touch.vector = { x: 0, y: 0 };
  }

  function updateJoystick(point) {
    const maxDistance = touchControls.joystick.r;
    const dx = point.x - touch.joystickBase.x;
    const dy = point.y - touch.joystickBase.y;
    const distance = Math.hypot(dx, dy);
    const scale = distance > maxDistance ? maxDistance / distance : 1;
    touch.joystickKnob = {
      x: touch.joystickBase.x + dx * scale,
      y: touch.joystickBase.y + dy * scale
    };
    touch.vector = {
      x: clamp(dx / maxDistance, -1, 1),
      y: clamp(dy / maxDistance, -1, 1)
    };
    const len = Math.hypot(touch.vector.x, touch.vector.y);
    if (len > 1) {
      touch.vector.x /= len;
      touch.vector.y /= len;
    }
  }

  function setTouchAction(name, active) {
    touch[name] = active;
  }

  function handlePointerDown(event) {
    if (!touchControlsVisible()) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    audio.unlock();
    const point = pointerPoint(event);
    let handled = false;

    if (pointInCircle(point, touchControls.deploy)) {
      touch.pointerActions.set(event.pointerId, "deploy");
      setTouchAction("deploy", true);
      handled = true;
    } else if (pointInCircle(point, touchControls.wall)) {
      touch.pointerActions.set(event.pointerId, "wall");
      setTouchAction("wall", true);
      handled = true;
    } else if (pointInRect(point, touchControls.reset)) {
      touch.pointerActions.set(event.pointerId, "reset");
      setTouchAction("reset", true);
      pressed.add("KeyR");
      handled = true;
    } else if (point.x < view.w * 0.46 && point.y > view.h * 0.45) {
      beginJoystick(event.pointerId, point);
      handled = true;
    }

    if (handled) {
      touch.available = true;
      canvas.setPointerCapture(event.pointerId);
      event.preventDefault();
    }
  }

  function handlePointerMove(event) {
    if (event.pointerId !== touch.joystickId) return;
    updateJoystick(pointerPoint(event));
    event.preventDefault();
  }

  function handlePointerEnd(event) {
    if (event.pointerId === touch.joystickId) {
      touch.joystickId = null;
      touch.vector = { x: 0, y: 0 };
      touch.joystickBase = { x: touchControls.joystick.x, y: touchControls.joystick.y };
      touch.joystickKnob = { ...touch.joystickBase };
      event.preventDefault();
    }

    const action = touch.pointerActions.get(event.pointerId);
    if (action) {
      setTouchAction(action, false);
      touch.pointerActions.delete(event.pointerId);
      event.preventDefault();
    }
  }

  function makeRng(seed) {
    let t = seed >>> 0;
    return {
      next() {
        t += 0x6d2b79f5;
        let x = t;
        x = Math.imul(x ^ (x >>> 15), x | 1);
        x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
        return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
      },
      range(min, max) {
        return min + (max - min) * this.next();
      },
      int(min, max) {
        return Math.floor(this.range(min, max + 1));
      }
    };
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function key(cell) {
    return `${cell.x},${cell.y}`;
  }

  function cellFromKey(value) {
    const parts = value.split(",");
    return { x: Number(parts[0]), y: Number(parts[1]) };
  }

  function hexToRgb(hex) {
    const raw = hex.replace("#", "");
    return {
      r: parseInt(raw.slice(0, 2), 16),
      g: parseInt(raw.slice(2, 4), 16),
      b: parseInt(raw.slice(4, 6), 16)
    };
  }

  function rgba(hex, alpha) {
    const rgb = hexToRgb(hex);
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
  }

  function createAudioSystem() {
    let context = null;
    let master = null;
    let lastUplinkTick = 0;
    let unlocked = false;

    function ensure() {
      if (context) return true;
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) return false;
      context = new AudioCtor();
      master = context.createGain();
      master.gain.value = 0.22;
      master.connect(context.destination);
      return true;
    }

    function unlock() {
      if (!ensure()) return;
      if (context.state === "suspended") context.resume();
      if (!unlocked) {
        unlocked = true;
        blip(220, 0.03, 0.015, "sine", 0.25);
      }
    }

    function tone(frequency, duration, gain, type = "sine", slide = 0) {
      if (!ensure() || !unlocked) return;
      const now = context.currentTime;
      const osc = context.createOscillator();
      const amp = context.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(frequency, now);
      if (slide !== 0) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(32, frequency + slide), now + duration);
      }
      amp.gain.setValueAtTime(0.0001, now);
      amp.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), now + 0.012);
      amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      osc.connect(amp);
      amp.connect(master);
      osc.start(now);
      osc.stop(now + duration + 0.02);
    }

    function noise(duration, gain, filterFrequency) {
      if (!ensure() || !unlocked) return;
      const now = context.currentTime;
      const bufferSize = Math.max(1, Math.floor(context.sampleRate * duration));
      const buffer = context.createBuffer(1, bufferSize, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i += 1) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
      }
      const source = context.createBufferSource();
      const filter = context.createBiquadFilter();
      const amp = context.createGain();
      source.buffer = buffer;
      filter.type = "bandpass";
      filter.frequency.value = filterFrequency;
      filter.Q.value = 8;
      amp.gain.setValueAtTime(gain, now);
      amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      source.connect(filter);
      filter.connect(amp);
      amp.connect(master);
      source.start(now);
      source.stop(now + duration);
    }

    function blip(frequency, duration, gain, type = "square", slide = 0) {
      tone(frequency, duration, gain, type, slide);
    }

    return {
      unlock,
      deploy(player) {
        const base = player.id === 1 ? 540 : 430;
        blip(base, 0.09, 0.04, "square", 90);
        blip(base * 1.5, 0.07, 0.022, "triangle", -60);
      },
      wall(player) {
        const base = player.id === 1 ? 260 : 220;
        blip(base, 0.12, 0.035, "sawtooth", -80);
        noise(0.06, 0.018, 1200);
      },
      propagate(player, depth = 0) {
        const base = player.id === 1 ? 720 : 610;
        blip(base + depth * 18, 0.045, 0.018, "square", -90);
      },
      hit(player) {
        const base = player.id === 1 ? 180 : 150;
        blip(base, 0.14, 0.055, "sawtooth", -70);
        noise(0.08, 0.035, 650);
      },
      jam(colorOwnerId) {
        const base = colorOwnerId === 1 ? 360 : 320;
        blip(base, 0.16, 0.052, "triangle", -120);
        noise(0.13, 0.026, 980);
      },
      uplink(progress, holderId, time) {
        if (!holderId || progress <= 0) return;
        if (time - lastUplinkTick < 0.52) return;
        lastUplinkTick = time;
        const base = holderId === 1 ? 880 : 760;
        blip(base + progress * 1.8, 0.04, 0.016, "sine", 30);
      },
      win(player) {
        const base = player.id === 1 ? 520 : 460;
        blip(base, 0.11, 0.05, "square", 180);
        setTimeout(() => blip(base * 1.25, 0.12, 0.05, "triangle", 240), 90);
        setTimeout(() => blip(base * 1.62, 0.18, 0.055, "sine", -80), 190);
      }
    };
  }

  function cellCenter(cell) {
    return {
      x: view.ox + (cell.x + 0.5) * view.tile,
      y: view.oy + (cell.y + 0.5) * view.tile
    };
  }

  function worldCell(pos) {
    return {
      x: Math.floor((pos.x - view.ox) / view.tile),
      y: Math.floor((pos.y - view.oy) / view.tile)
    };
  }

  function drawLine(a, b, color, width) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  function polygon(points, fill, stroke, width = 1) {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i += 1) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.closePath();
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = width;
      ctx.stroke();
    }
  }

  class Arena {
    constructor(seed) {
      this.seed = seed;
      this.rng = makeRng(seed);
      this.width = 19;
      this.height = 11;
      this.spawns = [{ x: 2, y: 2 }, { x: 16, y: 8 }];
      this.cells = [];
      this.streams = new Map();
      this.gates = new Map();
      this.tempWalls = new Map();
      this.tempOwners = new Map();
      this.generate();
    }

    generate() {
      this.cells = [];
      this.streams.clear();
      this.gates.clear();
      this.tempWalls.clear();
      this.tempOwners.clear();

      for (let y = 0; y < this.height; y += 1) {
        const row = [];
        for (let x = 0; x < this.width; x += 1) {
          const cell = { x, y };
          if (x === 0 || y === 0 || x === this.width - 1 || y === this.height - 1) {
            row.push(CELL.HARD);
          } else if (this.spawnSafe(cell)) {
            row.push(CELL.EMPTY);
          } else {
            const roll = this.rng.next();
            if (roll < 0.1) row.push(CELL.HARD);
            else if (roll < 0.28) row.push(CELL.SOFT);
            else if (roll < 0.36) row.push(CELL.UNSTABLE);
            else row.push(CELL.EMPTY);
          }
        }
        this.cells.push(row);
      }

      this.carveRoutes();
      this.placeGates();
      this.placeStreams();
    }

    spawnSafe(cell) {
      return this.spawns.some((spawn) => Math.abs(cell.x - spawn.x) + Math.abs(cell.y - spawn.y) <= 2);
    }

    carveRoutes() {
      const routeY = Math.floor(this.height / 2);
      const routeX = Math.floor(this.width / 2);
      for (let x = 1; x < this.width - 1; x += 1) {
        if (this.rng.next() < 0.82) this.set({ x, y: routeY }, CELL.EMPTY);
      }
      for (let y = 1; y < this.height - 1; y += 1) {
        if (this.rng.next() < 0.72) this.set({ x: routeX, y }, CELL.EMPTY);
      }
      for (const spawn of this.spawns) {
        for (let y = spawn.y - 1; y <= spawn.y + 1; y += 1) {
          for (let x = spawn.x - 1; x <= spawn.x + 1; x += 1) {
            this.set({ x, y }, CELL.EMPTY);
          }
        }
      }
    }

    placeGates() {
      const a = { x: 3, y: this.height - 3 };
      const b = { x: this.width - 4, y: 2 };
      this.set(a, CELL.GATE);
      this.set(b, CELL.GATE);
      this.gates.set(key(a), b);
      this.gates.set(key(b), a);
    }

    placeStreams() {
      for (const y of [3, this.height - 4]) {
        for (let x = 2; x < this.width - 3; x += 1) {
          const from = { x, y };
          const to = { x: x + 1, y };
          if (this.propagable(from) && this.propagable(to) && this.rng.next() < 0.44) {
            this.streams.set(key(from), to);
          }
        }
      }
      for (const x of [6, this.width - 7]) {
        for (let y = 2; y < this.height - 3; y += 1) {
          const from = { x, y };
          const to = { x, y: y + 1 };
          if (this.propagable(from) && this.propagable(to) && this.rng.next() < 0.3) {
            this.streams.set(key(from), to);
          }
        }
      }
    }

    update(dt) {
      for (const [k, time] of this.tempWalls) {
        const next = time - dt;
        if (next <= 0) {
          this.tempWalls.delete(k);
          this.tempOwners.delete(k);
        } else {
          this.tempWalls.set(k, next);
        }
      }
    }

    inBounds(cell) {
      return cell.x >= 0 && cell.y >= 0 && cell.x < this.width && cell.y < this.height;
    }

    get(cell) {
      if (!this.inBounds(cell)) return CELL.HARD;
      return this.cells[cell.y][cell.x];
    }

    set(cell, value) {
      if (this.inBounds(cell)) this.cells[cell.y][cell.x] = value;
    }

    walkable(cell) {
      if (!this.inBounds(cell) || this.tempWalls.has(key(cell))) return false;
      const value = this.get(cell);
      return value === CELL.EMPTY || value === CELL.UNSTABLE || value === CELL.GATE;
    }

    propagable(cell) {
      if (!this.inBounds(cell) || this.tempWalls.has(key(cell))) return false;
      return this.get(cell) !== CELL.HARD;
    }

    canTempWall(cell) {
      const value = this.get(cell);
      return this.walkable(cell) && (value === CELL.EMPTY || value === CELL.UNSTABLE);
    }

    damageSoft(cell) {
      if (this.get(cell) === CELL.SOFT) {
        this.set(cell, CELL.EMPTY);
        return true;
      }
      return false;
    }

    setTempWall(cell, owner, duration) {
      this.tempWalls.set(key(cell), duration);
      this.tempOwners.set(key(cell), owner.id);
    }

    unstableBranchOpen(cell, dir) {
      let hash = this.seed + cell.x * 92821 + cell.y * 68917 + dir.x * 193 + dir.y * 389;
      hash = Math.abs(hash * 1103515245 + 12345);
      return hash % 100 < 52;
    }

    neighbors(cell) {
      const result = [];
      const dirs = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
      for (const dir of dirs) {
        const next = { x: cell.x + dir.x, y: cell.y + dir.y };
        if (this.propagable(next)) result.push(next);
      }

      const stream = this.streams.get(key(cell));
      if (stream && this.propagable(stream)) result.push(stream);

      const gate = this.gates.get(key(cell));
      if (gate && this.propagable(gate)) result.push(gate);

      if (this.get(cell) === CELL.UNSTABLE) {
        const diagonals = [{ x: 1, y: 1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: -1, y: -1 }];
        for (const dir of diagonals) {
          const next = { x: cell.x + dir.x, y: cell.y + dir.y };
          if (this.propagable(next) && this.unstableBranchOpen(cell, dir)) result.push(next);
        }
      }
      return result;
    }

    randomWalkable() {
      for (let i = 0; i < 128; i += 1) {
        const cell = {
          x: this.rng.int(1, this.width - 2),
          y: this.rng.int(1, this.height - 2)
        };
        if (this.walkable(cell)) return cell;
      }
      return this.spawns[0];
    }
  }

  class Player {
    constructor(game, id, name, spawn, color, bot) {
      this.game = game;
      this.id = id;
      this.name = name;
      this.spawn = spawn;
      this.color = color;
      this.bot = bot;
      this.pos = { x: spawn.x + 0.5, y: spawn.y + 0.5 };
      this.target = { ...this.pos };
      this.last = { x: 1, y: 0 };
      this.integrity = 100;
      this.alive = true;
      this.reboot = 0;
      this.nodeCooldown = 0;
      this.wallCooldown = 0;
      this.activeNodes = 0;
      this.botThink = 0;
    }

    update(dt) {
      this.nodeCooldown = Math.max(0, this.nodeCooldown - dt);
      this.wallCooldown = Math.max(0, this.wallCooldown - dt);

      if (!this.alive) {
        this.reboot -= dt;
        if (this.reboot <= 0) this.respawn();
        return;
      }

      const dir = this.bot ? this.botMovement(dt) : this.humanMovement();
      this.move(dir, dt);
      this.applyStreamDrift(dt);
      if (this.bot) this.botActions();
      else this.humanActions();
    }

    humanMovement() {
      const dir = { x: 0, y: 0 };
      if (keys.has("KeyA") || keys.has("ArrowLeft")) dir.x -= 1;
      if (keys.has("KeyD") || keys.has("ArrowRight")) dir.x += 1;
      if (keys.has("KeyW") || keys.has("ArrowUp")) dir.y -= 1;
      if (keys.has("KeyS") || keys.has("ArrowDown")) dir.y += 1;
      dir.x += touch.vector.x;
      dir.y += touch.vector.y;
      const len = Math.hypot(dir.x, dir.y) || 1;
      return { x: dir.x / len, y: dir.y / len };
    }

    humanActions() {
      if (keys.has("Space") || touch.deploy) this.tryDeploy();
      if (keys.has("ShiftLeft") || keys.has("ShiftRight") || touch.wall) this.tryWall();
    }

    botMovement(dt) {
      this.botThink -= dt;
      if (this.botThink <= 0 || Math.hypot(this.target.x - this.pos.x, this.target.y - this.pos.y) < 0.3) {
        this.botThink = this.game.arena.rng.range(0.32, 0.82);
        let target = this.game.arena.randomWalkable();
        if (this.game.uplink && this.game.arena.rng.next() < 0.42) {
          target = { ...this.game.uplink.cell };
        } else if (this.game.players.length && this.game.arena.rng.next() < 0.62) {
          const opponent = this.game.players[0];
          const around = {
            x: Math.floor(opponent.pos.x) + this.game.arena.rng.int(-3, 3),
            y: Math.floor(opponent.pos.y) + this.game.arena.rng.int(-2, 2)
          };
          if (this.game.arena.walkable(around)) target = around;
        }
        this.target = { x: target.x + 0.5, y: target.y + 0.5 };
      }
      const dir = { x: this.target.x - this.pos.x, y: this.target.y - this.pos.y };
      const len = Math.hypot(dir.x, dir.y) || 1;
      return { x: dir.x / len, y: dir.y / len };
    }

    botActions() {
      const opponent = this.game.players[0];
      const distance = Math.hypot(opponent.pos.x - this.pos.x, opponent.pos.y - this.pos.y);
      if (distance < 2.7 && this.game.arena.rng.next() < 0.035) this.tryDeploy();
      if (this.game.arena.rng.next() < 0.012) this.tryWall();
    }

    move(dir, dt) {
      if (Math.hypot(dir.x, dir.y) > 0.01) this.last = { ...dir };
      const speed = 3.4;
      const target = {
        x: this.pos.x + dir.x * speed * dt,
        y: this.pos.y + dir.y * speed * dt
      };
      if (this.game.arena.walkable({ x: Math.floor(target.x), y: Math.floor(target.y) })) {
        this.pos = target;
        return;
      }
      const xOnly = { x: target.x, y: this.pos.y };
      if (this.game.arena.walkable({ x: Math.floor(xOnly.x), y: Math.floor(xOnly.y) })) this.pos = xOnly;
      const yOnly = { x: this.pos.x, y: target.y };
      if (this.game.arena.walkable({ x: Math.floor(yOnly.x), y: Math.floor(yOnly.y) })) this.pos = yOnly;
    }

    applyStreamDrift(dt) {
      const cell = { x: Math.floor(this.pos.x), y: Math.floor(this.pos.y) };
      const stream = this.game.arena.streams.get(key(cell));
      if (!stream) return;
      const dir = { x: stream.x - cell.x, y: stream.y - cell.y };
      const len = Math.hypot(dir.x, dir.y) || 1;
      const target = {
        x: this.pos.x + (dir.x / len) * 0.9 * dt,
        y: this.pos.y + (dir.y / len) * 0.9 * dt
      };
      if (this.game.arena.walkable({ x: Math.floor(target.x), y: Math.floor(target.y) })) this.pos = target;
    }

    tryDeploy() {
      if (this.nodeCooldown > 0 || this.activeNodes >= 2) return;
      const cell = { x: Math.floor(this.pos.x), y: Math.floor(this.pos.y) };
      if (this.game.deployNode(this, cell)) {
        this.activeNodes += 1;
        this.nodeCooldown = 0.42;
        audio.deploy(this);
      }
    }

    tryWall() {
      if (this.wallCooldown > 0) return;
      const target = {
        x: Math.floor(this.pos.x + this.last.x),
        y: Math.floor(this.pos.y + this.last.y)
      };
      if (this.game.arena.canTempWall(target)) {
        this.game.arena.setTempWall(target, this, 2.4);
        this.wallCooldown = 1.65;
        audio.wall(this);
      }
    }

    corrupt(amount) {
      if (!this.alive) return;
      this.integrity -= amount;
      if (this.integrity <= 0) {
        this.integrity = 0;
        this.alive = false;
        this.reboot = 1.6;
        this.activeNodes = 0;
      }
    }

    respawn() {
      this.pos = { x: this.spawn.x + 0.5, y: this.spawn.y + 0.5 };
      this.integrity = 100;
      this.alive = true;
      this.activeNodes = 0;
    }
  }

  class InfectionNode {
    constructor(owner, cell) {
      this.owner = owner;
      this.cell = { ...cell };
      this.elapsed = 0;
      this.arm = 1.65;
      this.radius = 5;
      this.chainWarning = false;
      this.done = false;
    }

    update(dt, game) {
      this.elapsed += dt;
      if (!this.done && this.elapsed >= this.arm) {
        this.done = true;
        game.propagate(this);
        this.owner.activeNodes = Math.max(0, this.owner.activeNodes - 1);
      }
    }

    chain(delay) {
      if (this.done) return;
      this.chainWarning = true;
      this.arm = Math.min(this.arm, this.elapsed + delay);
    }
  }

  class Game {
    constructor() {
      this.seed = 7331;
      this.time = 0;
      this.reset();
    }

    reset() {
      this.time = 0;
      this.arena = new Arena(this.seed);
      this.nodes = new Map();
      this.pulses = [];
      this.events = [];
      this.bursts = [];
      this.roundWinner = null;
      this.roundResetTimer = 0;
      this.players = [
        new Player(this, 1, "NULL VECTOR", this.arena.spawns[0], colors.cyan, false),
        new Player(this, 2, "RED GHOST", this.arena.spawns[1], colors.magenta, true)
      ];
      this.uplink = this.createUplink();
    }

    update(dt) {
      this.time += dt;
      if (pressed.has("KeyR")) {
        this.seed += 97;
        this.reset();
      }

      if (this.roundWinner) {
        this.roundResetTimer -= dt;
        if (this.roundResetTimer <= 0) {
          this.seed += 97;
          this.reset();
        }
        pressed.clear();
        return;
      }

      this.arena.update(dt);
      for (const player of this.players) player.update(dt);
      this.updateUplink(dt);

      for (const [k, node] of [...this.nodes]) {
        node.update(dt, this);
        if (node.done && node.elapsed > node.arm + 0.48) this.nodes.delete(k);
      }

      for (const event of this.events) {
        if (!event.done && event.at <= this.time) {
          event.done = true;
          this.resolveCell(event.cell, event.source, event.intensity);
        }
      }
      this.events = this.events.filter((event) => !event.done);

      for (const pulse of this.pulses) pulse.age += dt;
      this.pulses = this.pulses.filter((pulse) => pulse.age <= pulse.duration);

      for (const burst of this.bursts) burst.age += dt;
      this.bursts = this.bursts.filter((burst) => burst.age <= burst.duration);

      pressed.clear();
    }

    deployNode(owner, cell) {
      if (!this.arena.walkable(cell)) return false;
      const k = key(cell);
      if (this.nodes.has(k)) return false;
      this.nodes.set(k, new InfectionNode(owner, cell));
      return true;
    }

    createUplink() {
      const cell = { x: Math.floor(this.arena.width / 2), y: Math.floor(this.arena.height / 2) };
      this.arena.set(cell, CELL.EMPTY);
      return {
        cell,
        radius: 1.16,
        progress: [0, 0],
        holder: 0,
        contested: false,
        jamTimer: 0,
        jamColor: colors.violet,
        pulse: 0
      };
    }

    updateUplink(dt) {
      this.uplink.pulse += dt;
      this.uplink.jamTimer = Math.max(0, this.uplink.jamTimer - dt);

      const present = [];
      const center = { x: this.uplink.cell.x + 0.5, y: this.uplink.cell.y + 0.5 };
      for (const player of this.players) {
        if (!player.alive) continue;
        const distance = Math.hypot(player.pos.x - center.x, player.pos.y - center.y);
        if (distance <= this.uplink.radius) present.push(player);
      }

      this.uplink.contested = present.length > 1;
      this.uplink.holder = present.length === 1 ? present[0].id : 0;

      if (this.uplink.jamTimer > 0 || this.uplink.contested || present.length === 0) {
        this.uplink.progress[0] = Math.max(0, this.uplink.progress[0] - dt * 2.5);
        this.uplink.progress[1] = Math.max(0, this.uplink.progress[1] - dt * 2.5);
        return;
      }

      const holder = present[0];
      const ownIndex = holder.id - 1;
      const enemyIndex = 1 - ownIndex;
      this.uplink.progress[ownIndex] = Math.min(100, this.uplink.progress[ownIndex] + dt * 13.5);
      this.uplink.progress[enemyIndex] = Math.max(0, this.uplink.progress[enemyIndex] - dt * 6);

      if (this.uplink.progress[ownIndex] >= 100) {
        this.roundWinner = holder;
        this.roundResetTimer = 3.2;
        audio.win(holder);
      } else {
        audio.uplink(this.uplink.progress[ownIndex], holder.id, this.time);
      }
    }

    jamUplink(source) {
      const wasJammed = this.uplink.jamTimer > 0;
      this.uplink.jamTimer = 0.9;
      this.uplink.jamColor = source ? source.owner.color : colors.violet;
      if (!wasJammed) audio.jam(source ? source.owner.id : 0);
      this.bursts.push({
        cell: this.uplink.cell,
        color: this.uplink.jamColor,
        age: 0,
        duration: 0.5
      });
    }

    cellTouchesUplink(cell) {
      return Math.hypot(cell.x - this.uplink.cell.x, cell.y - this.uplink.cell.y) <= 1.05;
    }

    tracePropagation(source) {
      const frontier = [{ ...source.cell }];
      const came = new Map();
      const depth = new Map();
      const order = [{
        cell: { ...source.cell },
        parent: { ...source.cell },
        depth: 0,
        blocked: false
      }];
      came.set(key(source.cell), { ...source.cell });
      depth.set(key(source.cell), 0);

      while (frontier.length) {
        const current = frontier.shift();
        const currentDepth = depth.get(key(current));
        if (currentDepth >= source.radius) continue;
        for (const next of this.arena.neighbors(current)) {
          const nk = key(next);
          if (came.has(nk)) continue;
          came.set(nk, current);
          depth.set(nk, currentDepth + 1);
          order.push({
            cell: { ...next },
            parent: { ...current },
            depth: currentDepth + 1,
            blocked: this.arena.get(next) === CELL.SOFT
          });
          if (this.arena.get(next) !== CELL.SOFT) frontier.push({ ...next });
        }
      }
      return order;
    }

    propagate(source) {
      const trace = this.tracePropagation(source);
      for (const route of trace) {
        const cell = route.cell;
        const d = route.depth;
        if (key(cell) !== key(source.cell)) {
          this.pulses.push({
            from: route.parent,
            to: cell,
            color: source.owner.color,
            age: 0,
            duration: 0.15 + d * 0.012
          });
          if (route.depth <= 2 && route.depth > 0) audio.propagate(source.owner, route.depth);
        }
        this.events.push({
          at: this.time + d * 0.07,
          cell,
          source,
          intensity: Math.max(0.55, 1 - d * 0.045),
          done: false
        });
      }
    }

    resolveCell(cell, source, intensity) {
      if (this.arena.damageSoft(cell)) return;

      if (this.cellTouchesUplink(cell)) {
        this.jamUplink(source);
      }

      const node = this.nodes.get(key(cell));
      if (node && node !== source) node.chain(0.08);

      for (const player of this.players) {
        if (player.alive && Math.floor(player.pos.x) === cell.x && Math.floor(player.pos.y) === cell.y) {
          const before = player.integrity;
          player.corrupt(38 * intensity);
          if (before > player.integrity) audio.hit(player);
        }
      }

      if (this.arena.get(cell) === CELL.UNSTABLE) {
        this.bursts.push({
          cell,
          color: source ? source.owner.color : colors.violet,
          age: 0,
          duration: 0.42
        });
        const dirs = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
        for (const dir of dirs) {
          const next = { x: cell.x + dir.x, y: cell.y + dir.y };
          if (this.arena.propagable(next)) {
            this.events.push({
              at: this.time + 0.09,
              cell: next,
              source: null,
              intensity: 0.45,
              done: false
            });
          }
        }
      }
    }

    draw() {
      drawBackground(this.time);
      drawArena(this.arena, this.time);
      drawUplink(this);
      drawPropagationPreviews(this);
      drawPulses(this.pulses);
      drawBursts(this.bursts);
      for (const node of this.nodes.values()) drawNode(node);
      for (const player of this.players) drawPlayer(player, this.time);
      drawHud(this);
      if (touchControlsVisible()) drawTouchControls(this);
      if (this.roundWinner) drawWinnerBanner(this);
    }
  }

  function drawBackground(time) {
    ctx.clearRect(0, 0, view.w, view.h);
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, view.w, view.h);
    for (let i = 0; i < 24; i += 1) {
      const y = (time * 14 + i * 43) % view.h;
      drawLine({ x: 0, y }, { x: view.w, y: y + 24 }, `rgba(0, 242, 255, ${0.025 + 0.02 * Math.sin(time * 1.7 + i)})`, 1);
    }
  }

  function drawArena(arena, time) {
    for (let y = 0; y < arena.height; y += 1) {
      for (let x = 0; x < arena.width; x += 1) {
        const cell = { x, y };
        const px = view.ox + x * view.tile;
        const py = view.oy + y * view.tile;
        ctx.fillStyle = (x + y) % 2 === 0 ? "rgba(8, 12, 23, 0.96)" : "rgba(6, 9, 18, 0.96)";
        ctx.fillRect(px + 1, py + 1, view.tile - 2, view.tile - 2);
        ctx.strokeStyle = "rgba(0, 242, 255, 0.055)";
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 1.5, py + 1.5, view.tile - 3, view.tile - 3);

        const wallOwner = arena.tempOwners.get(key(cell));
        if (arena.tempWalls.has(key(cell))) {
          drawTempWall(px, py, wallOwner === 1 ? colors.cyan : colors.magenta);
          continue;
        }

        const value = arena.get(cell);
        if (value === CELL.HARD) drawHardWall(px, py);
        if (value === CELL.SOFT) drawSoftWall(px, py);
        if (value === CELL.UNSTABLE) drawUnstable(px, py, cell, time);
        if (value === CELL.GATE) drawGate(px, py, time);
      }
    }

    for (const [fromKey, to] of arena.streams) {
      drawStream(cellFromKey(fromKey), to, time);
    }

    for (const [fromKey, to] of arena.gates) {
      const from = cellFromKey(fromKey);
      if (from.y * arena.width + from.x < to.y * arena.width + to.x) {
        dashed(cellCenter(from), cellCenter(to), "rgba(178, 56, 255, 0.16)", 2, 12);
      }
    }
  }

  function drawHardWall(px, py) {
    const pad = view.tile * 0.12;
    polygon([
      { x: px + pad, y: py + pad * 1.2 },
      { x: px + view.tile - pad, y: py + pad * 0.75 },
      { x: px + view.tile - pad * 0.8, y: py + view.tile - pad * 1.3 },
      { x: px + pad * 1.2, y: py + view.tile - pad }
    ], "rgba(18, 25, 42, 0.98)", "rgba(0, 242, 255, 0.34)", 1.6);
  }

  function drawSoftWall(px, py) {
    const pad = view.tile * 0.16;
    ctx.fillStyle = "rgba(66, 8, 42, 0.88)";
    ctx.fillRect(px + pad, py + pad, view.tile - pad * 2, view.tile - pad * 2);
    drawLine({ x: px + pad, y: py + pad }, { x: px + view.tile - pad, y: py + view.tile - pad }, "rgba(255, 20, 147, 0.72)", 2);
    drawLine({ x: px + view.tile - pad, y: py + pad }, { x: px + pad, y: py + view.tile - pad }, "rgba(255, 20, 147, 0.44)", 1);
  }

  function drawTempWall(px, py, color) {
    const pad = view.tile * 0.1;
    ctx.fillStyle = rgba(color, 0.14);
    ctx.fillRect(px + pad, py + pad, view.tile - pad * 2, view.tile - pad * 2);
    for (let i = 0; i < 4; i += 1) {
      const x = px + pad + 8 + i * view.tile * 0.19;
      drawLine({ x, y: py + pad + 4 }, { x: x + view.tile * 0.17, y: py + view.tile - pad - 4 }, rgba(color, 0.78), 2);
    }
  }

  function drawUnstable(px, py, cell, time) {
    const center = { x: px + view.tile / 2, y: py + view.tile / 2 };
    const radius = view.tile * (0.18 + 0.025 * Math.sin(time * 5 + cell.x));
    ctx.fillStyle = "rgba(178, 56, 255, 0.16)";
    ctx.beginPath();
    ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(178, 56, 255, 0.55)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(center.x, center.y, radius + 6, 0.4, 5.4);
    ctx.stroke();
  }

  function drawGate(px, py, time) {
    const center = { x: px + view.tile / 2, y: py + view.tile / 2 };
    ctx.strokeStyle = "rgba(0, 242, 255, 0.74)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(center.x, center.y, view.tile * 0.3, time * 2, time * 2 + Math.PI * 1.65);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255, 20, 147, 0.58)";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(center.x, center.y, view.tile * 0.42, -time * 1.5, -time * 1.5 + Math.PI * 1.45);
    ctx.stroke();
  }

  function drawStream(from, to, time) {
    const a = cellCenter(from);
    const b = cellCenter(to);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    drawLine({ x: a.x - ux * 13, y: a.y - uy * 13 }, { x: b.x + ux * 13, y: b.y + uy * 13 }, "rgba(0, 242, 255, 0.18)", 5);
    for (let i = 0; i < 3; i += 1) {
      const t = (time * 1.6 + i * 0.33) % 1;
      const p = { x: a.x + dx * t, y: a.y + dy * t };
      polygon([
        { x: p.x + ux * 10, y: p.y + uy * 10 },
        { x: p.x - ux * 7 - uy * 5, y: p.y - uy * 7 + ux * 5 },
        { x: p.x - ux * 7 + uy * 5, y: p.y - uy * 7 - ux * 5 }
      ], "rgba(0, 242, 255, 0.48)");
    }
  }

  function dashed(a, b, color, width, step) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    const ux = dx / len;
    const uy = dy / len;
    for (let d = 0; d < len; d += step * 2) {
      drawLine({ x: a.x + ux * d, y: a.y + uy * d }, { x: a.x + ux * Math.min(d + step, len), y: a.y + uy * Math.min(d + step, len) }, color, width);
    }
  }

  function drawPulses(pulses) {
    for (const pulse of pulses) {
      const life = clamp(pulse.age / pulse.duration, 0, 1);
      const a = cellCenter(pulse.from);
      const b = cellCenter(pulse.to);
      const head = { x: a.x + (b.x - a.x) * life, y: a.y + (b.y - a.y) * life };
      drawLine(a, head, rgba(pulse.color, 0.2), 8);
      drawLine(a, head, rgba(pulse.color, 0.82), 2.2);
      ctx.fillStyle = rgba(pulse.color, 0.82);
      ctx.beginPath();
      ctx.arc(head.x, head.y, 5.5 + 5 * (1 - life), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawUplink(game) {
    const uplink = game.uplink;
    const center = cellCenter(uplink.cell);
    const radius = view.tile * uplink.radius;
    const pulse = 0.55 + 0.45 * Math.sin(game.time * 4 + uplink.pulse);
    const jammed = uplink.jamTimer > 0;
    const contested = uplink.contested && !jammed;
    const ringColor = jammed ? uplink.jamColor : contested ? colors.violet : colors.green;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = rgba(ringColor, jammed ? 0.09 : 0.055 + 0.025 * pulse);
    ctx.beginPath();
    ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = rgba(ringColor, jammed ? 0.7 : 0.42);
    ctx.lineWidth = jammed ? 3 : 2;
    ctx.beginPath();
    ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
    ctx.stroke();

    drawUplinkProgressArc(center, radius + 7, game.players[0].color, uplink.progress[0], -Math.PI * 0.98);
    drawUplinkProgressArc(center, radius + 13, game.players[1].color, uplink.progress[1], Math.PI * 0.02);

    const coreSize = view.tile * 0.28;
    polygon([
      { x: center.x, y: center.y - coreSize },
      { x: center.x + coreSize, y: center.y },
      { x: center.x, y: center.y + coreSize },
      { x: center.x - coreSize, y: center.y }
    ], "rgba(3, 6, 13, 0.9)", rgba(ringColor, 0.86), 2);

    ctx.font = "700 10px Segoe UI, sans-serif";
    ctx.fillStyle = "rgba(221, 235, 255, 0.82)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(jammed ? "JAM" : contested ? "LOCK" : "UPLINK", center.x, center.y);
    ctx.restore();
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  function drawUplinkProgressArc(center, radius, color, progress, start) {
    ctx.strokeStyle = rgba(color, 0.86);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(center.x, center.y, radius, start, start + Math.PI * 1.9 * clamp(progress / 100, 0, 1));
    ctx.stroke();
  }

  function drawPropagationPreviews(game) {
    for (const node of game.nodes.values()) {
      if (node.done) continue;
      const trace = game.tracePropagation(node);
      const charge = clamp(node.elapsed / node.arm, 0, 1);
      const baseAlpha = node.chainWarning ? 0.3 : 0.08 + charge * 0.12;
      const color = node.owner.color;

      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (const route of trace) {
        if (route.depth === 0) continue;
        const from = cellCenter(route.parent);
        const to = cellCenter(route.cell);
        const depthFade = clamp(1 - route.depth / (node.radius + 1), 0.22, 0.82);
        const alpha = baseAlpha * depthFade;
        dashed(from, to, rgba(color, alpha), route.blocked ? 1.4 : 2, route.blocked ? 6 : 8);
      }

      for (const route of trace) {
        const center = cellCenter(route.cell);
        const depthFade = clamp(1 - route.depth / (node.radius + 1), 0.18, 0.72);
        const alpha = baseAlpha * depthFade;
        drawPreviewCellMarker(center, color, alpha, route.blocked, route.depth === 0);
      }
      ctx.restore();
    }
  }

  function drawPreviewCellMarker(center, color, alpha, blocked, origin) {
    const size = origin ? view.tile * 0.26 : view.tile * 0.18;
    const gap = size * 0.42;
    const line = Math.max(1, view.tile * 0.035);
    const markerAlpha = origin ? alpha * 1.25 : alpha;
    const stroke = blocked ? rgba(colors.magenta, markerAlpha * 1.15) : rgba(color, markerAlpha);
    ctx.strokeStyle = stroke;
    ctx.lineWidth = blocked ? line * 0.8 : line;

    const corners = [
      { sx: -1, sy: -1 },
      { sx: 1, sy: -1 },
      { sx: 1, sy: 1 },
      { sx: -1, sy: 1 }
    ];
    for (const corner of corners) {
      const x = center.x + corner.sx * size;
      const y = center.y + corner.sy * size;
      ctx.beginPath();
      ctx.moveTo(x, y + corner.sy * gap);
      ctx.lineTo(x, y);
      ctx.lineTo(x + corner.sx * gap, y);
      ctx.stroke();
    }

    if (blocked) {
      drawLine(
        { x: center.x - size * 0.7, y: center.y - size * 0.7 },
        { x: center.x + size * 0.7, y: center.y + size * 0.7 },
        rgba(colors.magenta, markerAlpha * 0.9),
        1
      );
    }
  }

  function drawBursts(bursts) {
    for (const burst of bursts) {
      const center = cellCenter(burst.cell);
      const life = burst.age / burst.duration;
      for (let i = 0; i < 8; i += 1) {
        const angle = (i / 8) * Math.PI * 2 + burst.age * 8;
        const end = {
          x: center.x + Math.cos(angle) * (18 + 34 * life),
          y: center.y + Math.sin(angle) * (18 + 34 * life)
        };
        drawLine(center, end, rgba(burst.color, 0.5 * (1 - life)), 1.5);
      }
    }
  }

  function drawNode(node) {
    if (node.done) return;
    const center = cellCenter(node.cell);
    const t = clamp(node.elapsed / node.arm, 0, 1);
    const pulse = 0.65 + 0.35 * Math.sin(node.elapsed * 15);
    ctx.fillStyle = rgba(node.owner.color, 0.1);
    ctx.beginPath();
    ctx.arc(center.x, center.y, 21 + 5 * pulse, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = rgba(node.owner.color, node.chainWarning ? 0.86 : 0.26 + 0.46 * t);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(center.x, center.y, 22, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * t);
    ctx.stroke();

    polygon([
      { x: center.x, y: center.y - 16 },
      { x: center.x + 15, y: center.y - 3 },
      { x: center.x + 8, y: center.y + 15 },
      { x: center.x - 11, y: center.y + 12 },
      { x: center.x - 16, y: center.y - 6 }
    ], "rgba(4, 7, 13, 0.92)", node.owner.color, 2);
    drawLine({ x: center.x - 7, y: center.y }, { x: center.x + 8, y: center.y }, "rgba(255, 255, 255, 0.34)", 1);
  }

  function drawPlayer(player, time) {
    const center = {
      x: view.ox + player.pos.x * view.tile,
      y: view.oy + player.pos.y * view.tile
    };

    if (!player.alive) {
      ctx.fillStyle = rgba(player.color, 0.08);
      ctx.beginPath();
      ctx.arc(center.x, center.y, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = rgba(player.color, 0.22);
      ctx.stroke();
      return;
    }

    ctx.fillStyle = rgba(player.color, 0.1 + 0.06 * Math.sin(time * 8));
    ctx.beginPath();
    ctx.arc(center.x, center.y, 24, 0, Math.PI * 2);
    ctx.fill();

    polygon([
      { x: center.x, y: center.y - 21 },
      { x: center.x + 17, y: center.y - 8 },
      { x: center.x + 12, y: center.y + 15 },
      { x: center.x, y: center.y + 22 },
      { x: center.x - 13, y: center.y + 12 },
      { x: center.x - 18, y: center.y - 8 }
    ], "rgba(3, 6, 13, 0.94)", player.color, 2.3);

    drawLine({ x: center.x - 8, y: center.y - 2 }, { x: center.x + 9, y: center.y - 2 }, "rgba(255, 255, 255, 0.52)", 1.2);
    drawLine({ x: center.x, y: center.y - 17 }, { x: center.x + player.last.x * 18, y: center.y - 17 + player.last.y * 18 }, rgba(player.color, 0.82), 2);

    ctx.fillStyle = "rgba(8, 8, 14, 0.9)";
    ctx.fillRect(center.x - 17, center.y + 28, 34, 4);
    ctx.fillStyle = player.color;
    ctx.fillRect(center.x - 17, center.y + 28, 34 * player.integrity / 100, 4);
  }

  function drawHud(game) {
    const x = 24;
    const y = 18;
    const w = Math.min(1232, view.w - 48);
    const compact = w < 760;
    const h = compact ? 94 : 74;
    ctx.fillStyle = colors.panel;
    ctx.strokeStyle = "rgba(0, 242, 255, 0.18)";
    ctx.lineWidth = 1;
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

    ctx.font = compact ? "700 20px Segoe UI, sans-serif" : "700 26px Segoe UI, sans-serif";
    ctx.fillStyle = colors.cyan;
    ctx.fillText("GRIDHACK", x + 16, y + (compact ? 25 : 31));
    ctx.font = "12px Segoe UI, sans-serif";
    ctx.fillStyle = colors.white;
    if (!compact) ctx.fillText("BREACH UPLINK // FFA", x + 16, y + 54);

    if (compact) {
      const rowW = Math.max(126, (w - 42) * 0.5);
      drawPlayerHud(game.players[0], x + 14, y + 38, rowW, true);
      drawPlayerHud(game.players[1], x + 26 + rowW, y + 38, rowW, true);
    } else {
      let rowX = x + 360;
      for (const player of game.players) {
        drawPlayerHud(player, rowX, y + 10, 280, false);
        rowX += 296;
      }
    }

    ctx.fillStyle = colors.magenta;
    ctx.font = "12px Segoe UI, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(`SEED ${game.seed}`, x + w - 18, y + (compact ? 24 : 43));
    ctx.textAlign = "left";

    if (!compact) {
      drawObjectiveMiniHud(game, x + w - 260, y + 52, 156);
    }
  }

  function drawObjectiveMiniHud(game, x, y, width) {
    const p1 = game.uplink.progress[0] / 100;
    const p2 = game.uplink.progress[1] / 100;
    ctx.font = "700 10px Segoe UI, sans-serif";
    ctx.fillStyle = "rgba(221, 235, 255, 0.7)";
    ctx.fillText(game.uplink.jamTimer > 0 ? "UPLINK JAMMED" : "UPLINK CONTROL", x, y - 10);
    bar(x, y, width, 4, p1, game.players[0].color);
    bar(x, y + 7, width, 4, p2, game.players[1].color);
  }

  function drawPlayerHud(player, x, y, width, compact) {
    ctx.fillStyle = "rgba(4, 7, 14, 0.88)";
    ctx.strokeStyle = rgba(player.color, 0.24);
    ctx.fillRect(x, y, width, 44);
    ctx.strokeRect(x + 0.5, y + 0.5, width - 1, 43);

    ctx.fillStyle = player.color;
    ctx.font = compact ? "700 11px Segoe UI, sans-serif" : "700 13px Segoe UI, sans-serif";
    ctx.fillText(compact ? player.name.replace(" VECTOR", "") : player.name, x + 10, y + 16);
    ctx.fillStyle = colors.white;
    ctx.font = compact ? "10px Segoe UI, sans-serif" : "11px Segoe UI, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(player.alive ? "ONLINE" : "REBOOT", x + width - 10, y + 16);
    ctx.textAlign = "left";

    const inner = width - 20;
    bar(x + 10, y + 24, inner, 6, player.integrity / 100, player.color);
    bar(x + 10, y + 35, inner * 0.48, 4, 1 - clamp(player.nodeCooldown / 0.42, 0, 1), colors.cyan);
    bar(x + 10 + inner * 0.52, y + 35, inner * 0.48, 4, 1 - clamp(player.wallCooldown / 1.65, 0, 1), colors.magenta);
  }

  function bar(x, y, w, h, amount, color) {
    ctx.fillStyle = "rgba(16, 20, 33, 0.95)";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w * clamp(amount, 0, 1), h);
  }

  function drawTouchControls(game) {
    const player = game.players[0];
    drawJoystick();
    drawTouchButton(touchControls.wall, touch.wall, 1 - clamp(player.wallCooldown / 1.65, 0, 1));
    drawTouchButton(touchControls.deploy, touch.deploy, 1 - clamp(player.nodeCooldown / 0.42, 0, 1));
    drawResetButton();
  }

  function drawJoystick() {
    const joy = touchControls.joystick;
    const base = touch.joystickId == null ? { x: joy.x, y: joy.y } : touch.joystickBase;
    const knob = touch.joystickId == null ? { x: joy.x, y: joy.y } : touch.joystickKnob;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = "rgba(0, 242, 255, 0.055)";
    ctx.strokeStyle = "rgba(0, 242, 255, 0.32)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(base.x, base.y, joy.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = "rgba(221, 235, 255, 0.18)";
    ctx.lineWidth = 1;
    drawLine({ x: base.x - joy.r * 0.62, y: base.y }, { x: base.x + joy.r * 0.62, y: base.y }, "rgba(221, 235, 255, 0.18)", 1);
    drawLine({ x: base.x, y: base.y - joy.r * 0.62 }, { x: base.x, y: base.y + joy.r * 0.62 }, "rgba(221, 235, 255, 0.18)", 1);

    ctx.fillStyle = touch.joystickId == null ? "rgba(0, 242, 255, 0.16)" : "rgba(0, 242, 255, 0.32)";
    ctx.strokeStyle = touch.joystickId == null ? "rgba(0, 242, 255, 0.42)" : "rgba(0, 242, 255, 0.9)";
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(knob.x, knob.y, joy.knobR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawTouchButton(button, active, ready) {
    const fillAlpha = active ? 0.28 : 0.12;
    const borderAlpha = ready >= 0.98 ? 0.86 : 0.38;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = rgba(button.color, fillAlpha);
    ctx.strokeStyle = rgba(button.color, borderAlpha);
    ctx.lineWidth = active ? 3 : 2;
    ctx.beginPath();
    ctx.arc(button.x, button.y, button.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = rgba(button.color, 0.88);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(button.x, button.y, button.r - 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ready);
    ctx.stroke();

    ctx.font = "700 11px Segoe UI, sans-serif";
    ctx.fillStyle = "rgba(221, 235, 255, 0.86)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(button.label, button.x, button.y);
    ctx.restore();
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  function drawResetButton() {
    const reset = touchControls.reset;
    ctx.save();
    ctx.fillStyle = touch.reset ? "rgba(255, 20, 147, 0.22)" : "rgba(8, 13, 25, 0.62)";
    ctx.strokeStyle = "rgba(255, 20, 147, 0.42)";
    ctx.lineWidth = 1.5;
    roundRect(reset.x - reset.w * 0.5, reset.y - reset.h * 0.5, reset.w, reset.h, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(221, 235, 255, 0.82)";
    ctx.font = "700 11px Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("RESET", reset.x, reset.y + 1);
    ctx.restore();
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  function drawWinnerBanner(game) {
    const winner = game.roundWinner;
    const w = Math.min(520, view.w - 40);
    const h = 92;
    const x = (view.w - w) * 0.5;
    const y = (view.h - h) * 0.5;

    ctx.save();
    ctx.fillStyle = "rgba(3, 6, 13, 0.86)";
    ctx.strokeStyle = rgba(winner.color, 0.74);
    ctx.lineWidth = 2;
    roundRect(x, y, w, h, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = winner.color;
    ctx.font = "700 24px Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${winner.name} BREACHED`, x + w * 0.5, y + 34);
    ctx.fillStyle = "rgba(221, 235, 255, 0.78)";
    ctx.font = "12px Segoe UI, sans-serif";
    ctx.fillText("NEXT SECTOR LOADING", x + w * 0.5, y + 64);
    ctx.restore();
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  const game = new Game();
  let last = performance.now();

  function frame(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    game.update(dt);
    game.draw();
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
})();
