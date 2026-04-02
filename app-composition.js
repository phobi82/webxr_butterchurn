// app/config.js
const appConfig = {
	audio: {
		youtubePlaylistUrl: "https://www.youtube.com/playlist?list=PLIEp7kQLbRSheVOUHZLuqj3fHO415l3Y-&autoplay=1",
		youtubeHouseDiscoUrl: "https://www.youtube.com/watch?v=m5nnbvJWXHI&list=PLIEp7kQLbRSicV0ozGNgDaEX54AEUNYRz&autoplay=1",
		youtubeWindowName: "webxrYoutubePlaylist",
		youtubeHouseDiscoWindowName: "webxrYoutubeHouseDisco",
		sunoLiveRadioUrl: "https://suno.com/labs/live-radio",
		sunoWindowName: "webxrSunoLiveRadio"
	},
	locomotion: {
		walkSpeed: 4,
		sprintMultiplier: 2,
		turnSpeed: 2,
		jumpSpeed: 3.55,
		jumpHoldBoostSpeed: 6.5,
		jumpHoldMaxSeconds: 0.22,
		airBoostSpeed: 14,
		xrGroundAcceleration: 96,
		xrAirAcceleration: 10,
		airMomentumDrag: 0.35,
		groundMomentumDrag: 10,
		doubleJumpMaxCount: 2,
		jumpGravity: -8.6,
		fallResetY: -25,
		playerRadius: 0.32,
		playerHeadClearance: 0.12,
		defaultEyeHeight: 1.7,
		tiptoeEyeHeightBoost: 0.3,
		crouchMinEyeHeight: 0.5,
		crouchSpeed: 1.8,
		climbSpeed: 2.4,
		stepHeight: 0.5,
		desktopStartZ: 5.6,
		desktopStartPitch: -0.16
	},
	menu: {
		rayLength: 4,
		eyeDistanceMin: 0.02,
		eyeDistanceMax: 0.2,
		floorAlphaMin: 0,
		floorAlphaMax: 1,
		desktopMenuPreviewWidthPixels: 420,
		jumpModeDoubleMinU: 0.1,
		jumpModeDoubleMaxU: 0.45,
		jumpModeMultiMinU: 0.55,
		jumpModeMultiMaxU: 0.9,
		menuSliderMinU: 0.18, // left edge of slider track in normalized menu UV
		menuSliderMaxU: 0.82, // right edge of slider track
		menuSliderHalfHeight: 0.055, // vertical hit region half-height
		maxMenuTextureHeight: 2304, // max canvas height for menu texture
		presetPrevMinU: 0.08, // left arrow button region
		presetPrevMaxU: 0.22,
		presetNextMinU: 0.78, // right arrow button region
		presetNextMaxU: 0.92,
		initialJumpMode: "double",
		initialFloorAlpha: 0.72,
		initialEyeDistanceMeters: 0.064,
		initialDesktopPreviewVisibleBool: false,
		previewStyle: {right: "12px", top: "12px"}
	},
	passthrough: {
		initialBlendModeKey: "uniform",
		initialUniformBlendModeKey: "audioReactive",
		initialLightingModeKey: "club",
		initialLightingAnchorModeKey: "auto",
		initialLightingDarkness: 0.05,
		initialManualMix: 0,
		initialAudioReactiveIntensity: -1,
		initialFlashlightRadius: 0.15,
		initialFlashlightSoftness: 0.05,
		initialDepthEchoMrRetain: 0.95
	},
	lighting: {
		initialPresetIndex: 4
	},
	runtime: {
		desktopMouseSensitivity: 0.0024,
		stickDeadzone: 0.08,
		stanceStickDeadzone: 0.22,
		stanceVerticalDominanceMargin: 0.12
	},
	scene: {
		floorHalfSize: 40,
		menuWidth: 0.74,
		sceneGlbAssets: [
			{
				url: "https://phobi82.github.io/Phobis-Crystal-Lake/goat.glb",
				position: {x: -1.4, y: 0.256, z: -2.6},
				scale: 1,
				rotationY: -0.55,
				collisionBool: true
			}
		],
		// Box: {x,y,z, width,height,depth, color:[r,g,b,a]} — floating platforms in open space
		levelBoxes: [
			{x: 0, y: 0.6, z: -6, width: 2.4, height: 1.2, depth: 2.4, color: [0.2, 0.72, 1, 0.72]},
			{x: -3.6, y: 0.9, z: -10.5, width: 2.6, height: 1.8, depth: 2.6, color: [1, 0.55, 0.2, 0.72]},
			{x: 4.2, y: 1.3, z: -13.5, width: 3, height: 2.6, depth: 3, color: [0.3, 1, 0.55, 0.72]},
			{x: 0, y: 1.2, z: -18, width: 8, height: 2.4, depth: 1.3, color: [1, 0.28, 0.42, 0.68]},
			{x: -8.5, y: 1.6, z: -8, width: 1.2, height: 3.2, depth: 10, color: [0.95, 0.2, 0.8, 0.48]},
			{x: 8.5, y: 1.6, z: -8, width: 1.2, height: 3.2, depth: 10, color: [0.1, 0.95, 0.9, 0.48]}
		]
	}
};

// app/create-app.js
const createApp = function(projectConfig) {
	projectConfig = projectConfig || {};
	const shell = normalizeAppShell(projectConfig.shell, {documentRef: document});
	const config = {
		audio: Object.assign({}, appConfig.audio, projectConfig.audio || {}),
		locomotion: Object.assign({}, appConfig.locomotion, projectConfig.locomotion || {}),
		menu: Object.assign({}, appConfig.menu, projectConfig.menu || {}),
		passthrough: Object.assign({}, appConfig.passthrough, projectConfig.passthrough || {}),
		lighting: Object.assign({}, appConfig.lighting, projectConfig.lighting || {}),
		runtime: Object.assign({}, appConfig.runtime, projectConfig.runtime || {}),
		scene: Object.assign({}, appConfig.scene, projectConfig.scene || {}),
		renderPolicy: Object.assign({
			visualizerBackgroundEnabledBool: true
		}, projectConfig.renderPolicy || {})
	};
	let assetStoreRef = null;
	const menuViewFactory = projectConfig.createMenuView || createMenuView;
	const menuControllerFactory = projectConfig.createMenuController || createMenuController;
	const passthroughController = createPassthroughController(config.passthrough);
	const menuView = menuViewFactory(Object.assign({documentRef: document, menuWorldWidth: config.scene.menuWidth}, config.menu));
	const menuController = menuControllerFactory(Object.assign({menuView: menuView, menuWidth: config.scene.menuWidth, passthroughController: passthroughController}, config.menu));
	const audioController = createAudioSourceController({
		setStatus: shell.setStatus,
		mediaDevices: navigator.mediaDevices || null,
		openWindow: function(url, windowName) {
			return window.open(url, windowName);
		},
		onStateChange: shell.setAudioState
	});
	const sceneLighting = createSceneLighting(config.lighting);
	const collisionWorld = createCollisionWorld({
		staticBoxes: config.scene.levelBoxes,
		dynamicBoxSources: [function() {
			return assetStoreRef && assetStoreRef.getCollisionBoxes ? assetStoreRef.getCollisionBoxes() : [];
		}],
		floorHalfSize: config.scene.floorHalfSize,
		playerRadius: config.locomotion.playerRadius,
		stepHeight: config.locomotion.stepHeight
	});
	const locomotion = createLocomotion(Object.assign({world: collisionWorld}, config.locomotion));
	const sessionBridge = createXrSessionBridge({
		xrApi: navigator.xr || null,
		xrWebGLLayer: window.XRWebGLLayer || null,
		xrWebGLBinding: window.XRWebGLBinding || null,
		xrRigidTransform: window.XRRigidTransform || null
	});
	const sceneRenderer = createSceneRenderer({
		canvas: shell.canvas,
		onInitFailure: function() {
			shell.setXrState({statusText: "WebGL not available.", enterEnabledBool: false, exitEnabledBool: false});
		},
		clampNumber: function(value, minValue, maxValue) {
			return Math.max(minValue, Math.min(maxValue, value));
		},
		levelBoxes: config.scene.levelBoxes,
		floorHalfSize: config.scene.floorHalfSize,
		floorReceivesSceneLightingBool: projectConfig.floorReceivesSceneLightingBool,
		menuWidth: config.scene.menuWidth,
		maxSceneLights: MAX_DIRECTIONAL_LIGHTS,
		getLightingUniformLocations: getLightingUniformLocations,
		applyLightingUniforms: applyLightingUniforms
	});
	const runtime = createRuntime({
		windowRef: window,
		documentRef: document,
		shell: shell,
		getReactiveFloorColors: projectConfig.getReactiveFloorColors,
		menuDefaults: {
			jumpMode: config.menu.initialJumpMode,
			floorAlpha: config.menu.initialFloorAlpha,
			eyeDistanceMeters: config.menu.initialEyeDistanceMeters,
			desktopPreviewVisibleBool: config.menu.initialDesktopPreviewVisibleBool
		},
		sessionBridge: sessionBridge,
		audioController: audioController,
		locomotion: locomotion,
		menuController: menuController,
		passthroughController: passthroughController,
		sceneRenderer: sceneRenderer,
		sceneLighting: sceneLighting,
		createGlbAssetStore: function(gl) {
			assetStoreRef = createGlbAssetStore({
				gl: gl,
				fetchFn: window.fetch ? window.fetch.bind(window) : null,
				createImageBitmapFn: window.createImageBitmap ? window.createImageBitmap.bind(window) : null,
				imageCtor: window.Image,
				blobCtor: window.Blob,
				textDecoderCtor: window.TextDecoder,
				urlApi: window.URL,
				setStatus: shell.setStatus,
				getLightingState: function() {
					return sceneLighting.getState();
				},
				getLightingUniformLocations: getLightingUniformLocations,
				applyLightingUniforms: applyLightingUniforms,
				maxSceneLights: MAX_DIRECTIONAL_LIGHTS
			});
			return assetStoreRef;
		},
		createVisualizerSourceBackend: function() {
			return createButterchurnSource({windowRef: window, documentRef: document});
		},
		createVisualizerEngine: function() {
			return createVisualizerEngine({
				modes: visualizerModeDefinitions
			});
		},
		renderPolicy: config.renderPolicy,
		sceneGlbAssets: config.scene.sceneGlbAssets,
		inputConfig: config.runtime,
		tabSources: {
			youtube: {key: "youtube", url: config.audio.youtubePlaylistUrl, windowName: config.audio.youtubeWindowName, sourceName: "YT Synth", blockedMessage: "yt synth tab blocked", selectStatus: "select the YT Synth tab and enable tab audio", activeStatus: "yt synth tab audio active"},
			youtubeHouseDisco: {key: "youtubeHouseDisco", url: config.audio.youtubeHouseDiscoUrl, windowName: config.audio.youtubeHouseDiscoWindowName, sourceName: "YT House/Disco", blockedMessage: "yt house disco tab blocked", selectStatus: "select the YT House/Disco tab and enable tab audio", activeStatus: "yt house disco tab audio active"},
			suno: {key: "suno", url: config.audio.sunoLiveRadioUrl, windowName: config.audio.sunoWindowName, sourceName: "Suno Live Radio", blockedMessage: "suno live radio tab blocked", selectStatus: "select the Suno Live Radio tab and enable tab audio", activeStatus: "suno live radio tab audio active"}
		}
	});
	return runtime;
};
