// App composition: shell contract, shared defaults, and system assembly.

const normalizeAppShell = function(shell, options) {
	shell = shell || {};
	options = options || {};
	const canvas = shell.canvas || null;
	if (!canvas) {
		throw new Error("App shell requires a canvas.");
	}
	const documentRef = options.documentRef || document;
	return {
		canvas: canvas,
		enterButton: shell.enterButton || null,
		exitButton: shell.exitButton || null,
		audioButton: shell.audioButton || null,
		microphoneButton: shell.microphoneButton || null,
		debugAudioButton: shell.debugAudioButton || null,
		stopAudioButton: shell.stopAudioButton || null,
		youtubeAudioButton: shell.youtubeAudioButton || null,
		youtubeHouseDiscoButton: shell.youtubeHouseDiscoButton || null,
		sunoLiveRadioButton: shell.sunoLiveRadioButton || null,
		setStatus: typeof shell.setStatus === "function" ? shell.setStatus : function() {},
		setXrState: typeof shell.setXrState === "function" ? shell.setXrState : function() {},
		setAudioState: typeof shell.setAudioState === "function" ? shell.setAudioState : function() {},
		syncCanvasToViewport: typeof shell.syncCanvasToViewport === "function" ? shell.syncCanvasToViewport : function(viewport) {
			viewport = viewport || {};
			const width = viewport.width == null ? 0 : viewport.width;
			const height = viewport.height == null ? 0 : viewport.height;
			const pixelRatio = viewport.pixelRatio == null ? 1 : viewport.pixelRatio;
			canvas.width = width * pixelRatio;
			canvas.height = height * pixelRatio;
		},
		requestCanvasPointerLock: typeof shell.requestCanvasPointerLock === "function" ? shell.requestCanvasPointerLock : function() {
			if (canvas.requestPointerLock) {
				canvas.requestPointerLock();
			}
		},
		isCanvasPointerLocked: typeof shell.isCanvasPointerLocked === "function" ? shell.isCanvasPointerLocked : function(activeDocumentRef) {
			const pointerDocumentRef = activeDocumentRef || documentRef;
			return pointerDocumentRef.pointerLockElement === canvas;
		}
	};
};

// Shared defaults stay here so app composition remains the single top-level owner.
const DEFAULT_APP_CONFIG = {
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
		menuSliderMinU: 0.18,
		menuSliderMaxU: 0.82,
		menuSliderHalfHeight: 0.055,
		maxMenuTextureHeight: 2304,
		presetPrevMinU: 0.08,
		presetPrevMaxU: 0.22,
		presetNextMinU: 0.78,
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

const DEFAULT_RENDER_POLICY = {
	visualizerBackgroundEnabledBool: true
};

const mergeAppConfig = function(projectConfig) {
	projectConfig = projectConfig || {};
	const mergeConfigSection = function(defaults, overrides) {
		return Object.assign({}, defaults, overrides || {});
	};
	return {
		audio: mergeConfigSection(DEFAULT_APP_CONFIG.audio, projectConfig.audio),
		locomotion: mergeConfigSection(DEFAULT_APP_CONFIG.locomotion, projectConfig.locomotion),
		menu: mergeConfigSection(DEFAULT_APP_CONFIG.menu, projectConfig.menu),
		passthrough: mergeConfigSection(DEFAULT_APP_CONFIG.passthrough, projectConfig.passthrough),
		lighting: mergeConfigSection(DEFAULT_APP_CONFIG.lighting, projectConfig.lighting),
		runtime: mergeConfigSection(DEFAULT_APP_CONFIG.runtime, projectConfig.runtime),
		scene: mergeConfigSection(DEFAULT_APP_CONFIG.scene, projectConfig.scene),
		renderPolicy: mergeConfigSection(DEFAULT_RENDER_POLICY, projectConfig.renderPolicy)
	};
};

const createAppTabSources = function(audioConfig) {
	return {
		youtube: {
			key: "youtube",
			url: audioConfig.youtubePlaylistUrl,
			windowName: audioConfig.youtubeWindowName,
			sourceName: "YT Synth",
			blockedMessage: "yt synth tab blocked",
			selectStatus: "select the YT Synth tab and enable tab audio",
			activeStatus: "yt synth tab audio active"
		},
		youtubeHouseDisco: {
			key: "youtubeHouseDisco",
			url: audioConfig.youtubeHouseDiscoUrl,
			windowName: audioConfig.youtubeHouseDiscoWindowName,
			sourceName: "YT House/Disco",
			blockedMessage: "yt house disco tab blocked",
			selectStatus: "select the YT House/Disco tab and enable tab audio",
			activeStatus: "yt house disco tab audio active"
		},
		suno: {
			key: "suno",
			url: audioConfig.sunoLiveRadioUrl,
			windowName: audioConfig.sunoWindowName,
			sourceName: "Suno Live Radio",
			blockedMessage: "suno live radio tab blocked",
			selectStatus: "select the Suno Live Radio tab and enable tab audio",
			activeStatus: "suno live radio tab audio active"
		}
	};
};

const createAppSystems = function(args) {
	const shell = args.shell;
	const config = args.config;
	const documentRef = args.documentRef;
	const windowRef = args.windowRef;
	const navigatorRef = args.navigatorRef;
	const projectConfig = args.projectConfig;
	let assetStoreRef = null;
	const mergeMenuConfig = function(baseConfig) {
		return Object.assign({}, config.menu, baseConfig);
	};
	const passthroughController = createPassthroughController(config.passthrough);
	const menuViewFactory = projectConfig.createMenuView || createMenuView;
	const menuControllerFactory = projectConfig.createMenuController || createMenuController;
	const menuView = menuViewFactory(mergeMenuConfig({
		documentRef: documentRef,
		menuWorldWidth: config.scene.menuWidth
	}));
	const menuController = menuControllerFactory(mergeMenuConfig({
		menuView: menuView,
		menuWidth: config.scene.menuWidth,
		passthroughController: passthroughController
	}));
	const audioController = createAudioSourceController({
		setStatus: shell.setStatus,
		mediaDevices: navigatorRef.mediaDevices || null,
		openWindow: function(url, windowName) {
			return windowRef.open(url, windowName);
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
		xrApi: navigatorRef.xr || null,
		xrWebGLLayer: windowRef.XRWebGLLayer || null,
		xrWebGLBinding: windowRef.XRWebGLBinding || null,
		xrRigidTransform: windowRef.XRRigidTransform || null
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
	return {
		audioController: audioController,
		locomotion: locomotion,
		menuController: menuController,
		passthroughController: passthroughController,
		sceneLighting: sceneLighting,
		sceneRenderer: sceneRenderer,
		sessionBridge: sessionBridge,
		createGlbAssetStore: function(gl) {
			assetStoreRef = createGlbAssetStore({
				gl: gl,
				fetchFn: windowRef.fetch ? windowRef.fetch.bind(windowRef) : null,
				createImageBitmapFn: windowRef.createImageBitmap ? windowRef.createImageBitmap.bind(windowRef) : null,
				imageCtor: windowRef.Image,
				blobCtor: windowRef.Blob,
				textDecoderCtor: windowRef.TextDecoder,
				urlApi: windowRef.URL,
				setStatus: shell.setStatus,
				getLightingState: function() {
					return sceneLighting.getState();
				},
				getLightingUniformLocations: getLightingUniformLocations,
				applyLightingUniforms: applyLightingUniforms,
				maxSceneLights: MAX_DIRECTIONAL_LIGHTS
			});
			return assetStoreRef;
		}
	};
};

const createApp = function(projectConfig) {
	projectConfig = projectConfig || {};
	const documentRef = projectConfig.documentRef || document;
	const windowRef = projectConfig.windowRef || window;
	const navigatorRef = projectConfig.navigatorRef || navigator;
	const shell = normalizeAppShell(projectConfig.shell, {documentRef: documentRef});
	const config = mergeAppConfig(projectConfig);
	const systems = createAppSystems({
		shell: shell,
		config: config,
		projectConfig: projectConfig,
		documentRef: documentRef,
		windowRef: windowRef,
		navigatorRef: navigatorRef
	});
	return createRuntime({
		windowRef: windowRef,
		documentRef: documentRef,
		shell: shell,
		getReactiveFloorColors: projectConfig.getReactiveFloorColors,
		menuDefaults: {
			jumpMode: config.menu.initialJumpMode,
			floorAlpha: config.menu.initialFloorAlpha,
			eyeDistanceMeters: config.menu.initialEyeDistanceMeters,
			desktopPreviewVisibleBool: config.menu.initialDesktopPreviewVisibleBool
		},
		sessionBridge: systems.sessionBridge,
		audioController: systems.audioController,
		locomotion: systems.locomotion,
		menuController: systems.menuController,
		passthroughController: systems.passthroughController,
		sceneRenderer: systems.sceneRenderer,
		sceneLighting: systems.sceneLighting,
		createGlbAssetStore: systems.createGlbAssetStore,
		createVisualizerSourceBackend: function() {
			return createButterchurnSource({windowRef: windowRef, documentRef: documentRef});
		},
		createVisualizerEngine: function() {
			return createVisualizerEngine({
				modes: visualizerModeDefinitions
			});
		},
		renderPolicy: config.renderPolicy,
		sceneGlbAssets: config.scene.sceneGlbAssets,
		inputConfig: config.runtime,
		tabSources: createAppTabSources(config.audio)
	});
};
