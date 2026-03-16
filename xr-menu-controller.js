(function() {
	// Owns menu runtime state so rendering and input stay synchronized across XR and desktop.
	const clampNumber = window.xrVisualizerUtils.clampNumber;
	const normalizeVec3 = window.xrVisualizerUtils.normalizeVec3;
	const dotVec3 = window.xrVisualizerUtils.dotVec3;
	const extractForwardDirectionFromQuaternion = window.xrVisualizerUtils.extractForwardDirectionFromQuaternion;

	window.createXrMenuController = function(options) {
		options = options || {};
		const menuUi = options.menuUi;
		const menuCanvas = menuUi.menuCanvas;
		const previewCanvas = menuUi.previewCanvas;
		const controllerRays = [];
		const triggerPressedByHand = new Map();
		const state = {
			jumpMode: options.initialJumpMode || "double",
			menuOpenBool: false,
			menuTogglePressedBool: false,
			floorAlpha: options.initialFloorAlpha == null ? 0.72 : options.initialFloorAlpha,
			eyeDistanceMeters: options.initialEyeDistanceMeters == null ? 0.064 : options.initialEyeDistanceMeters,
			activeSliderHand: "",
			activeFloorAlphaSliderHand: "",
			eyeDistanceHoverBool: false,
			floorAlphaHoverBool: false,
			hoveredJumpMode: "",
			hoveredShaderModeAction: "",
			hoveredLightPresetAction: "",
			hoveredPresetAction: "",
			desktopPreviewVisibleBool: options.initialDesktopPreviewVisibleBool !== false,
			desktopPointerActiveBool: false,
			desktopPointerU: 0,
			desktopPointerV: 0,
			desktopPreviewEventsRegisteredBool: false
		};
		const menuPlane = {
			center: {x: 0, y: 1.45, z: -0.8},
			right: {x: 1, y: 0, z: 0},
			up: {x: 0, y: 1, z: 0},
			normal: {x: 0, y: 0, z: 1}
		};

		const eyeDistanceToSliderU = function(value) {
			return options.menuSliderMinU + (clampNumber(value, options.eyeDistanceMin, options.eyeDistanceMax) - options.eyeDistanceMin) / (options.eyeDistanceMax - options.eyeDistanceMin) * (options.menuSliderMaxU - options.menuSliderMinU);
		};

		const sliderUToEyeDistance = function(value) {
			return options.eyeDistanceMin + clampNumber((value - options.menuSliderMinU) / (options.menuSliderMaxU - options.menuSliderMinU), 0, 1) * (options.eyeDistanceMax - options.eyeDistanceMin);
		};

		const floorAlphaToSliderU = function(value) {
			return options.menuSliderMinU + (clampNumber(value, options.floorAlphaMin, options.floorAlphaMax) - options.floorAlphaMin) / (options.floorAlphaMax - options.floorAlphaMin) * (options.menuSliderMaxU - options.menuSliderMinU);
		};

		const sliderUToFloorAlpha = function(value) {
			return options.floorAlphaMin + clampNumber((value - options.menuSliderMinU) / (options.menuSliderMaxU - options.menuSliderMinU), 0, 1) * (options.floorAlphaMax - options.floorAlphaMin);
		};

		const clearHoverState = function() {
			state.eyeDistanceHoverBool = false;
			state.floorAlphaHoverBool = false;
			state.hoveredJumpMode = "";
			state.hoveredShaderModeAction = "";
			state.hoveredLightPresetAction = "";
			state.hoveredPresetAction = "";
		};

		const releaseSliderHand = function(hand) {
			if (state.activeSliderHand === hand) {
				state.activeSliderHand = "";
			}
			if (state.activeFloorAlphaSliderHand === hand) {
				state.activeFloorAlphaSliderHand = "";
			}
		};

		const applyDesktopHoverState = function(pointerLockedBool, xrSessionActiveBool) {
			if (xrSessionActiveBool || !state.desktopPreviewVisibleBool || pointerLockedBool || !state.desktopPointerActiveBool) {
				state.eyeDistanceHoverBool = state.activeSliderHand === "desktop";
				state.floorAlphaHoverBool = state.activeFloorAlphaSliderHand === "desktop";
				state.hoveredJumpMode = "";
				state.hoveredShaderModeAction = "";
				state.hoveredLightPresetAction = "";
				state.hoveredPresetAction = "";
				return;
			}
			const hit = options.menuUi.getInteractionAtUv(state.desktopPointerU, state.desktopPointerV);
			state.eyeDistanceHoverBool = !!hit.eyeDistanceSliderBool || state.activeSliderHand === "desktop";
			state.floorAlphaHoverBool = !!hit.floorAlphaSliderBool || state.activeFloorAlphaSliderHand === "desktop";
			state.hoveredJumpMode = hit.jumpMode || "";
			state.hoveredShaderModeAction = hit.shaderModeAction || "";
			state.hoveredLightPresetAction = hit.lightPresetAction || "";
			state.hoveredPresetAction = hit.presetAction || "";
			if (state.activeSliderHand === "desktop") {
				state.eyeDistanceMeters = sliderUToEyeDistance(state.desktopPointerU);
			}
			if (state.activeFloorAlphaSliderHand === "desktop") {
				state.floorAlpha = sliderUToFloorAlpha(state.desktopPointerU);
			}
		};

		const intersectMenu = function(ray) {
			if (!state.menuOpenBool) {
				return null;
			}
			const menuPlaneHeight = menuUi.getPlaneHeight(options.menuWidth);
			const denom = dotVec3(menuPlane.normal.x, menuPlane.normal.y, menuPlane.normal.z, ray.dir.x, ray.dir.y, ray.dir.z);
			if (Math.abs(denom) < 0.0001) {
				return null;
			}
			const distance = dotVec3(menuPlane.center.x - ray.origin.x, menuPlane.center.y - ray.origin.y, menuPlane.center.z - ray.origin.z, menuPlane.normal.x, menuPlane.normal.y, menuPlane.normal.z) / denom;
			if (distance <= 0 || distance > options.rayLength) {
				return null;
			}
			const point = {
				x: ray.origin.x + ray.dir.x * distance,
				y: ray.origin.y + ray.dir.y * distance,
				z: ray.origin.z + ray.dir.z * distance
			};
			const relX = point.x - menuPlane.center.x;
			const relY = point.y - menuPlane.center.y;
			const relZ = point.z - menuPlane.center.z;
			const localX = dotVec3(relX, relY, relZ, menuPlane.right.x, menuPlane.right.y, menuPlane.right.z);
			const localY = dotVec3(relX, relY, relZ, menuPlane.up.x, menuPlane.up.y, menuPlane.up.z);
			if (Math.abs(localX) > options.menuWidth * 0.5 || Math.abs(localY) > menuPlaneHeight * 0.5) {
				return null;
			}
			const u = 0.5 + localX / options.menuWidth;
			const v = 0.5 - localY / menuPlaneHeight;
			return Object.assign({distance: distance, point: point, u: u, v: v}, options.menuUi.getInteractionAtUv(u, v));
		};

		// XR rays reuse the same hit decoding as desktop so sliders and buttons behave identically.
		const updateControllerRays = function(frame, xrSession, xrRefSpace) {
			controllerRays.length = 0;
			clearHoverState();
			if (!xrSession || !xrRefSpace) {
				return;
			}
			const sources = xrSession.inputSources || [];
			for (let i = 0; i < sources.length; i += 1) {
				const source = sources[i];
				if (!source || source.targetRayMode !== "tracked-pointer") {
					continue;
				}
				const pose = frame.getPose(source.targetRaySpace, xrRefSpace);
				if (!pose) {
					continue;
				}
				const ray = {
					hand: source.handedness || "none",
					source: source,
					origin: {x: pose.transform.position.x, y: pose.transform.position.y, z: pose.transform.position.z},
					dir: extractForwardDirectionFromQuaternion(pose.transform.orientation),
					length: options.rayLength,
					hitBool: false,
					hitPoint: null,
					hit: null
				};
				const hit = intersectMenu(ray);
				if (hit) {
					ray.length = hit.distance;
					ray.hitBool = true;
					ray.hitPoint = hit.point;
					ray.hit = hit;
					state.eyeDistanceHoverBool = hit.eyeDistanceSliderBool || state.eyeDistanceHoverBool;
					state.floorAlphaHoverBool = hit.floorAlphaSliderBool || state.floorAlphaHoverBool;
					state.hoveredJumpMode = hit.jumpMode || state.hoveredJumpMode;
					state.hoveredShaderModeAction = hit.shaderModeAction || state.hoveredShaderModeAction;
					state.hoveredLightPresetAction = hit.lightPresetAction || state.hoveredLightPresetAction;
					state.hoveredPresetAction = hit.presetAction || state.hoveredPresetAction;
				}
				controllerRays.push(ray);
			}
		};

		return {
			getState: function() {
				return {
					jumpMode: state.jumpMode,
					menuOpenBool: state.menuOpenBool,
					floorAlpha: state.floorAlpha,
					eyeDistanceMeters: state.eyeDistanceMeters,
					desktopPreviewVisibleBool: state.desktopPreviewVisibleBool,
					plane: menuPlane,
					planeHeight: menuUi.getPlaneHeight(options.menuWidth)
				};
			},
			getControllerRays: function() {
				return controllerRays;
			},
			getRenderState: function(externalState) {
				externalState = externalState || {};
				return {
					sceneTimeSeconds: externalState.sceneTimeSeconds,
					audioMetrics: externalState.audioMetrics,
					jumpMode: state.jumpMode,
					hoveredJumpMode: state.hoveredJumpMode,
					hoveredShaderModeAction: state.hoveredShaderModeAction,
					hoveredLightPresetAction: state.hoveredLightPresetAction,
					hoveredPresetAction: state.hoveredPresetAction,
					floorAlpha: state.floorAlpha,
					eyeDistanceMeters: state.eyeDistanceMeters,
					floorAlphaHoverBool: state.floorAlphaHoverBool,
					eyeDistanceHoverBool: state.eyeDistanceHoverBool,
					floorAlphaSliderActiveBool: !!state.activeFloorAlphaSliderHand,
					eyeDistanceSliderActiveBool: !!state.activeSliderHand,
					shaderModeNames: externalState.shaderModeNames,
					currentShaderModeIndex: externalState.currentShaderModeIndex,
					lightPresetNames: externalState.lightPresetNames,
					currentLightPresetIndex: externalState.currentLightPresetIndex,
					currentLightPresetDescription: externalState.currentLightPresetDescription,
					presetNames: externalState.presetNames,
					currentPresetIndex: externalState.currentPresetIndex,
					eyeDistanceMin: options.eyeDistanceMin,
					eyeDistanceMax: options.eyeDistanceMax,
					eyeDistanceSliderU: eyeDistanceToSliderU(state.eyeDistanceMeters),
					floorAlphaSliderU: floorAlphaToSliderU(state.floorAlpha)
				};
			},
			updateMenuPose: function(pose) {
				if (!pose) {
					return;
				}
				const matrix = pose.transform.matrix;
				const forward = normalizeVec3(-matrix[8], 0, -matrix[10]);
				menuPlane.normal.x = -forward.x;
				menuPlane.normal.y = 0;
				menuPlane.normal.z = -forward.z;
				menuPlane.right.x = menuPlane.normal.z;
				menuPlane.right.y = 0;
				menuPlane.right.z = -menuPlane.normal.x;
				menuPlane.up.x = 0;
				menuPlane.up.y = 1;
				menuPlane.up.z = 0;
				menuPlane.center.x = matrix[12] + forward.x * 0.8;
				menuPlane.center.y = matrix[13] - 0.03;
				menuPlane.center.z = matrix[14] + forward.z * 0.8;
			},
			renderTexture: function(gl, menuTexture, externalState) {
				options.menuUi.render(this.getRenderState(externalState));
				gl.bindTexture(gl.TEXTURE_2D, menuTexture);
				gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, menuCanvas);
			},
			updateDesktopPreview: function(args) {
				args = args || {};
				applyDesktopHoverState(args.pointerLockedBool, args.xrSessionActiveBool);
				options.menuUi.updateDesktopPreview({
					visibleBool: state.desktopPreviewVisibleBool,
					interactiveBool: !!args.interactiveBool,
					renderState: this.getRenderState(args.renderState)
				});
			},
			updateDesktopPointerFromEvent: function(event) {
				const rect = previewCanvas.getBoundingClientRect();
				if (rect.width <= 0 || rect.height <= 0) {
					return null;
				}
				state.desktopPointerU = clampNumber((event.clientX - rect.left) / rect.width, 0, 1);
				state.desktopPointerV = clampNumber((event.clientY - rect.top) / rect.height, 0, 1);
				state.desktopPointerActiveBool = true;
				return menuUi.getInteractionAtUv(state.desktopPointerU, state.desktopPointerV);
			},
			// Owns desktop preview pointer wiring so runtime only supplies callbacks and state.
			registerDesktopPreviewEvents: function(args) {
				args = args || {};
				if (state.desktopPreviewEventsRegisteredBool) {
					return;
				}
				const controller = this;
				const callbacks = args.callbacks || {};
				const getInteractionState = args.getInteractionState || function() {
					return {};
				};
				previewCanvas.addEventListener("mousemove", function(event) {
					controller.handleDesktopPointerMove(event, getInteractionState());
				});
				previewCanvas.addEventListener("mouseleave", function() {
					controller.handleDesktopPointerLeave();
				});
				previewCanvas.addEventListener("mousedown", function(event) {
					if (controller.handleDesktopPointerDown(event, callbacks, getInteractionState())) {
						event.preventDefault();
					}
				});
				state.desktopPreviewEventsRegisteredBool = true;
			},
			handleDesktopPointerMove: function(event, args) {
				args = args || {};
				if (args.xrSessionActiveBool || args.pointerLockedBool || !state.desktopPreviewVisibleBool) {
					return null;
				}
				return this.updateDesktopPointerFromEvent(event);
			},
			handleDesktopPointerLeave: function() {
				if (state.activeSliderHand === "desktop" || state.activeFloorAlphaSliderHand === "desktop") {
					return;
				}
				this.clearDesktopPointerState();
			},
			handleDesktopPointerDown: function(event, callbacks, args) {
				args = args || {};
				callbacks = callbacks || {};
				if (args.xrSessionActiveBool || args.pointerLockedBool || !state.desktopPreviewVisibleBool) {
					return false;
				}
				const hit = this.updateDesktopPointerFromEvent(event);
				if (!hit) {
					return false;
				}
				if (hit.jumpMode) {
					state.jumpMode = hit.jumpMode;
				}
				if (hit.shaderModeAction && callbacks.onShaderModeAction) {
					callbacks.onShaderModeAction(hit.shaderModeAction === "prev" ? -1 : 1);
				}
				if (hit.lightPresetAction && callbacks.onLightPresetAction) {
					callbacks.onLightPresetAction(hit.lightPresetAction === "prev" ? -1 : 1);
				}
				if (hit.presetAction && callbacks.onPresetAction) {
					callbacks.onPresetAction(hit.presetAction === "prev" ? -1 : 1);
				}
				if (hit.eyeDistanceSliderBool) {
					state.activeSliderHand = "desktop";
					state.eyeDistanceMeters = sliderUToEyeDistance(state.desktopPointerU);
				}
				if (hit.floorAlphaSliderBool) {
					state.activeFloorAlphaSliderHand = "desktop";
					state.floorAlpha = sliderUToFloorAlpha(state.desktopPointerU);
				}
				return true;
			},
			handleDesktopPointerUp: function() {
				releaseSliderHand("desktop");
			},
			clearDesktopPointerState: function() {
				state.desktopPointerActiveBool = false;
				state.desktopPointerU = 0;
				state.desktopPointerV = 0;
				clearHoverState();
				releaseSliderHand("desktop");
			},
			setDesktopPreviewVisibleBool: function(visibleBool) {
				state.desktopPreviewVisibleBool = !!visibleBool;
				if (!state.desktopPreviewVisibleBool) {
					this.clearDesktopPointerState();
					previewCanvas.style.display = "none";
					return;
				}
				previewCanvas.style.display = "block";
			},
			// Clears XR-session interaction state without resetting user menu choices.
			resetSessionState: function() {
				state.menuTogglePressedBool = false;
				triggerPressedByHand.clear();
			},
			endSession: function() {
				state.menuOpenBool = false;
				state.menuTogglePressedBool = false;
				state.activeSliderHand = "";
				state.activeFloorAlphaSliderHand = "";
				clearHoverState();
				controllerRays.length = 0;
				triggerPressedByHand.clear();
			},
			updateXrInput: function(args) {
				args = args || {};
				const callbacks = args.callbacks || {};
				const sources = args.xrSession ? args.xrSession.inputSources || [] : [];
				let togglePressedBool = false;
				for (let i = 0; i < sources.length; i += 1) {
					const source = sources[i];
					if (source.handedness === "left" && source.gamepad && source.gamepad.buttons[5] && source.gamepad.buttons[5].pressed) {
						togglePressedBool = true;
					}
				}
				if (togglePressedBool && !state.menuTogglePressedBool) {
					state.menuOpenBool = !state.menuOpenBool;
					state.activeSliderHand = "";
					state.activeFloorAlphaSliderHand = "";
					if (state.menuOpenBool) {
						this.updateMenuPose(args.pose);
					}
				}
				state.menuTogglePressedBool = togglePressedBool;
				updateControllerRays(args.frame, args.xrSession, args.xrRefSpace);
				for (let i = 0; i < controllerRays.length; i += 1) {
					const ray = controllerRays[i];
					const gamepad = ray.source.gamepad;
					const hand = ray.hand;
					const triggerPressedBool = !!(gamepad && gamepad.buttons[0] && gamepad.buttons[0].pressed);
					const wasTriggerPressedBool = triggerPressedByHand.get(hand) || false;
					if (triggerPressedBool && !wasTriggerPressedBool && ray.hit && ray.hit.jumpMode) {
						state.jumpMode = ray.hit.jumpMode;
					}
					if (triggerPressedBool && !wasTriggerPressedBool && ray.hit && ray.hit.shaderModeAction && callbacks.onShaderModeAction) {
						callbacks.onShaderModeAction(ray.hit.shaderModeAction === "prev" ? -1 : 1);
					}
					if (triggerPressedBool && !wasTriggerPressedBool && ray.hit && ray.hit.lightPresetAction && callbacks.onLightPresetAction) {
						callbacks.onLightPresetAction(ray.hit.lightPresetAction === "prev" ? -1 : 1);
					}
					if (triggerPressedBool && !wasTriggerPressedBool && ray.hit && ray.hit.presetAction && callbacks.onPresetAction) {
						callbacks.onPresetAction(ray.hit.presetAction === "prev" ? -1 : 1);
					}
					if (triggerPressedBool && ray.hit && ray.hit.eyeDistanceSliderBool && (!wasTriggerPressedBool || state.activeSliderHand === hand)) {
						state.activeSliderHand = hand;
						state.eyeDistanceMeters = sliderUToEyeDistance(ray.hit.u);
					}
					if (triggerPressedBool && ray.hit && ray.hit.floorAlphaSliderBool && (!wasTriggerPressedBool || state.activeFloorAlphaSliderHand === hand)) {
						state.activeFloorAlphaSliderHand = hand;
						state.floorAlpha = sliderUToFloorAlpha(ray.hit.u);
					}
					if (!triggerPressedBool && wasTriggerPressedBool) {
						releaseSliderHand(hand);
					}
					triggerPressedByHand.set(hand, triggerPressedBool);
				}
			}
		};
	};
})();
