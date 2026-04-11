// Menu sections, view, controller, and TestLab menu config.

// Sections
// This module owns generic menu section/control state builders.
const getMenuModeLabelByKey = function(definitions, key, fallbackLabel) {
	const index = findModeIndexByKey(definitions || [], key);
	return index >= 0 && definitions[index] ? definitions[index].label : (fallbackLabel || "");
};

const formatMenuPercentText = function(value) {
	return Math.round(value * 100) + "%";
};

const getLightingAnchorModeMetaText = function(key) {
	if (key === "vrWorld") {
		return "Fixed to the VR world";
	}
	if (key === "realWorld") {
		return "Fixed to the real room";
	}
	return "Auto: depth -> real room, fallback -> VR world";
};

const hasHoveredActionKey = function(args, hoverKey) {
	return !!(hoverKey && args && args.hoveredActionKeys && args.hoveredActionKeys[hoverKey]);
};

const getHoveredCyclerAction = function(args, prevHoverKey, nextHoverKey) {
	return hasHoveredActionKey(args, prevHoverKey) ? "prev" : (hasHoveredActionKey(args, nextHoverKey) ? "next" : "");
};

const createMenuSectionState = function(args) {
	args = args || {};
	return {
		key: args.key || "",
		columnIndex: args.columnIndex == null ? 1 : args.columnIndex,
		footerBool: !!args.footerBool,
		title: args.title || "",
		badgeText: args.badgeText || "",
		statusText: args.statusText || "",
		statusTone: args.statusTone || "muted",
		controls: args.controls || []
	};
};

const createCyclerMenuControlState = function(args) {
	args = args || {};
	return {
		type: "cycler",
		key: args.key || "",
		label: args.label || "",
		valueText: args.valueText || "",
		metaText: args.metaText || "",
		hoveredAction: args.hoveredAction || "",
		prevAction: args.prevAction || null,
		nextAction: args.nextAction || null,
		prevHoverKey: args.prevHoverKey || "",
		nextHoverKey: args.nextHoverKey || ""
	};
};

const createChoiceRowMenuControlState = function(args) {
	args = args || {};
	return {
		type: "choiceRow",
		key: args.key || "",
		label: args.label || "",
		rowStyle: args.rowStyle || "choice",
		items: args.items || []
	};
};

const createCheckboxMenuControlState = function(args) {
	args = args || {};
	return {
		type: "checkbox",
		key: args.key || "",
		label: args.label || "",
		valueText: args.valueText || "",
		checkedBool: !!args.checkedBool,
		hoveredBool: !!args.hoveredBool,
		action: args.action || null,
		hoverKey: args.hoverKey || ""
	};
};

const createSessionMenuSectionState = function(args) {
	args = args || {};
	if (!args.xrSessionActiveBool) {
		return null;
	}
	return createMenuSectionState({
		key: "session",
		columnIndex: args.columnIndex,
		footerBool: !!args.footerBool,
		title: "Session",
		statusText: "Leave the current immersive session.",
		controls: [
			createChoiceRowMenuControlState({
				key: "sessionAction",
				label: "",
				items: [
					{
						key: "exitVr",
						label: "Exit VR",
						metaText: "End session",
						selectedBool: true,
						hoveredBool: hasHoveredActionKey(args, "exitVr"),
						action: {type: "session.exit"},
						hoverKey: "exitVr"
					}
				]
			})
		]
	});
};

const createSliderMenuControlState = function(args) {
	args = args || {};
	return {
		type: "slider",
		key: args.key || "",
		label: args.label || "",
		valueText: args.valueText || "",
		sliderT: args.sliderT == null ? 0 : args.sliderT,
		minLabel: args.minLabel || "",
		maxLabel: args.maxLabel || "",
		hoveredBool: !!args.hoveredBool,
		activeBool: !!args.activeBool,
		sliderKey: args.sliderKey || args.key || "",
		hoverKey: args.hoverKey || args.key || ""
	};
};

const appendSliderMenuControls = function(targetControls, sliderControls) {
	sliderControls = sliderControls || [];
	for (let i = 0; i < sliderControls.length; i += 1) {
		const sliderControl = sliderControls[i];
		if (!sliderControl || !sliderControl.control) {
			continue;
		}
		targetControls.push(createSliderMenuControlState({
			key: sliderControl.control.key,
			label: sliderControl.control.label,
			valueText: sliderControl.control.valueText || formatMenuPercentText(sliderControl.control.value),
			sliderT: sliderControl.sliderT == null ? 0 : sliderControl.sliderT,
			minLabel: sliderControl.control.minLabel,
			maxLabel: sliderControl.control.maxLabel,
			hoveredBool: !!sliderControl.hoveredBool,
			activeBool: !!sliderControl.activeBool,
			sliderKey: sliderControl.control.key,
			hoverKey: sliderControl.control.key
		}));
	}
};

const createJumpModeMenuSectionState = function(args) {
	args = args || {};
	return createMenuSectionState({
		key: "jumpMode",
		columnIndex: args.columnIndex,
		title: "Jump Mode",
		controls: [
			createChoiceRowMenuControlState({
				key: "jumpMode",
				label: "",
				items: [
					{
						key: "double",
						label: "Double",
						metaText: "2 jumps total",
						selectedBool: args.selectedJumpMode === "double",
						hoveredBool: hasHoveredActionKey(args, "jumpMode:double"),
						action: {type: "jumpMode.set", mode: "double"},
						hoverKey: "jumpMode:double"
					},
					{
						key: "multi",
						label: "Multi",
						metaText: "Unlimited jumps",
						selectedBool: args.selectedJumpMode === "multi",
						hoveredBool: hasHoveredActionKey(args, "jumpMode:multi"),
						action: {type: "jumpMode.set", mode: "multi"},
						hoverKey: "jumpMode:multi"
					}
				]
			})
		]
	});
};

const createWorldOpacityMenuSectionState = function(args) {
	args = args || {};
	return createMenuSectionState({
		key: "worldOpacity",
		columnIndex: args.columnIndex,
		title: "World Opacity",
		badgeText: formatMenuPercentText(args.value || 0),
		controls: [
			createSliderMenuControlState({
				key: "floorAlpha",
				label: "",
				valueText: "",
				sliderT: args.sliderT == null ? 0 : args.sliderT,
				minLabel: "Invisible",
				maxLabel: "Solid",
				hoveredBool: !!args.hoveredBool,
				activeBool: !!args.activeBool,
				sliderKey: "floorAlpha",
				hoverKey: "floorAlpha"
			})
		]
	});
};

const createEyeDistanceMenuSectionState = function(args) {
	args = args || {};
	return createMenuSectionState({
		key: "eyeDistance",
		columnIndex: args.columnIndex,
		title: "Eye Distance",
		badgeText: Math.round((args.value || 0) * 1000) + " mm",
		controls: [
			createSliderMenuControlState({
				key: "eyeDistance",
				label: "",
				valueText: "",
				sliderT: args.sliderT == null ? 0 : args.sliderT,
				minLabel: Math.round((args.min || 0) * 1000) + " mm",
				maxLabel: Math.round((args.max || 0) * 1000) + " mm",
				hoveredBool: !!args.hoveredBool,
				activeBool: !!args.activeBool,
				sliderKey: "eyeDistance",
				hoverKey: "eyeDistance"
			})
		]
	});
};

const createVisualizerModeMenuSectionState = function(args) {
	args = args || {};
	return createMenuSectionState({
		key: "visualizerMode",
		columnIndex: args.columnIndex,
		title: "Visualizer Mode",
		controls: [
			createCyclerMenuControlState({
				key: "visualizerMode",
				label: "",
				valueText: args.valueText || "",
				metaText: args.metaText || "",
				hoveredAction: getHoveredCyclerAction(args, "visualizerMode:prev", "visualizerMode:next"),
				prevAction: {type: "visualizerMode.cycle", direction: -1},
				nextAction: {type: "visualizerMode.cycle", direction: 1},
				prevHoverKey: "visualizerMode:prev",
				nextHoverKey: "visualizerMode:next"
			}),
			createCheckboxMenuControlState({
				key: "visualizerHorizontalMirror",
				label: "Horiz. Mirror (Kaleidoscope-Mode)",
				valueText: args.checkboxValueText || "",
				checkedBool: !!args.horizontalMirrorBool,
				hoveredBool: hasHoveredActionKey(args, "visualizerHorizontalMirror:toggle"),
				action: {type: "visualizerHorizontalMirror.toggle"},
				hoverKey: "visualizerHorizontalMirror:toggle"
			})
		]
	});
};

const createButterchurnPresetMenuSectionState = function(args) {
	args = args || {};
	return createMenuSectionState({
		key: "butterchurnPreset",
		columnIndex: args.columnIndex,
		title: "Butterchurn Preset",
		controls: [
			createCyclerMenuControlState({
				key: "butterchurnPreset",
				label: "",
				valueText: args.valueText || "",
				metaText: args.metaText || "",
				hoveredAction: getHoveredCyclerAction(args, "butterchurnPreset:prev", "butterchurnPreset:next"),
				prevAction: {type: "butterchurnPreset.cycle", direction: -1},
				nextAction: {type: "butterchurnPreset.cycle", direction: 1},
				prevHoverKey: "butterchurnPreset:prev",
				nextHoverKey: "butterchurnPreset:next"
			})
		]
	});
};

const createBackgroundMenuSectionState = function(args) {
	args = args || {};
	const uiState = args.uiState || {};
	const controls = [];
	controls.push(createChoiceRowMenuControlState({
		key: "backgroundMixMode",
		label: "Mix Mode",
		items: (uiState.mixModes || []).map(function(item) {
			return {
				key: item.key,
				label: item.label,
				selectedBool: item.key === uiState.selectedMixModeKey,
				hoveredBool: hasHoveredActionKey(args, "backgroundMixMode:" + item.key),
				action: {type: "backgroundMixMode.select", key: item.key},
				hoverKey: "backgroundMixMode:" + item.key
			};
		})
	}));
	appendSliderMenuControls(controls, args.sliderControls);
	return createMenuSectionState({
		key: "background",
		columnIndex: args.columnIndex,
		title: "Background",
		badgeText: formatMenuPercentText(uiState.visibleShare || 0),
		controls: controls
	});
};

const createPassthroughMenuSectionState = function(args) {
	args = args || {};
	const uiState = args.uiState || {};
	const controls = [];
	const passthroughSliderControls = args.sliderControls || [];
	const flashlightSliderControls = [];
	const depthSliderControls = [];
	const depthSliderControlByKey = {};
	const echoReactiveControlByKey = {};
	const appendDepthSliderControlByKey = function(controlKey) {
		const sliderControl = depthSliderControlByKey[controlKey];
		if (!sliderControl || !sliderControl.control) {
			return;
		}
		controls.push(createSliderMenuControlState({
			key: sliderControl.control.key,
			label: sliderControl.control.label,
			valueText: sliderControl.control.valueText || formatMenuPercentText(sliderControl.control.value),
			sliderT: sliderControl.sliderT == null ? 0 : sliderControl.sliderT,
			minLabel: sliderControl.control.minLabel,
			maxLabel: sliderControl.control.maxLabel,
			hoveredBool: !!sliderControl.hoveredBool,
			activeBool: !!sliderControl.activeBool
		}));
	};
	for (let i = 0; i < passthroughSliderControls.length; i += 1) {
		const sliderControl = passthroughSliderControls[i];
		const controlKey = sliderControl && sliderControl.control ? sliderControl.control.key : "";
		if (controlKey.indexOf("depth") === 0) {
			depthSliderControls.push(sliderControl);
			depthSliderControlByKey[controlKey] = sliderControl;
			continue;
		}
		flashlightSliderControls.push(sliderControl);
	}
	for (let i = 0; i < (uiState.echoReactiveControls || []).length; i += 1) {
		echoReactiveControlByKey[uiState.echoReactiveControls[i].key] = uiState.echoReactiveControls[i];
	}
	controls.push(createCheckboxMenuControlState({
		key: "passthroughFlashlightToggle",
		label: "Flashlight",
		valueText: uiState.flashlightActiveBool ? "On" : "Off",
		checkedBool: !!uiState.flashlightActiveBool,
		hoveredBool: hasHoveredActionKey(args, "passthroughFlashlightToggle:toggle"),
		action: {type: "passthroughFlashlight.toggle"},
		hoverKey: "passthroughFlashlightToggle:toggle"
	}));
	appendSliderMenuControls(controls, flashlightSliderControls);
	if (uiState.usableDepthAvailableBool) {
		controls.push(createCheckboxMenuControlState({
			key: "passthroughDepthToggle",
			label: "Depth",
			valueText: uiState.depthActiveBool ? "On" : "Off",
			checkedBool: !!uiState.depthActiveBool,
			hoveredBool: hasHoveredActionKey(args, "passthroughDepthToggle:toggle"),
			action: {type: "passthroughDepth.toggle"},
			hoverKey: "passthroughDepthToggle:toggle"
		}));
	}
	if (uiState.usableDepthAvailableBool && uiState.depthActiveBool) {
		controls.push(createChoiceRowMenuControlState({
			key: "passthroughDepthMotionRow",
			label: "",
			rowStyle: "checkbox",
			items: [
				{
					key: "passthroughDepthRadialToggle",
					label: "real Distance Metric",
					valueText: uiState.depthRadialBool ? "radial" : "planar",
					checkedBool: !!uiState.depthRadialBool,
					hoveredBool: hasHoveredActionKey(args, "passthroughDepthRadialToggle:toggle"),
					action: {type: "passthroughDepthRadial.toggle"},
					hoverKey: "passthroughDepthRadialToggle:toggle"
				}
			]
		}));
		controls.push(createCyclerMenuControlState({
			key: "passthroughDepthMode",
			label: "Depth Mode",
			valueText: getMenuModeLabelByKey(uiState.depthModes, uiState.selectedDepthModeKey, "Distance"),
			hoveredAction: getHoveredCyclerAction(args, "passthroughDepthMode:prev", "passthroughDepthMode:next"),
			prevAction: {type: "passthroughDepthMode.cycle", direction: -1},
			nextAction: {type: "passthroughDepthMode.cycle", direction: 1},
			prevHoverKey: "passthroughDepthMode:prev",
			nextHoverKey: "passthroughDepthMode:next"
		}));

	}
	if (uiState.depthActiveBool && uiState.selectedDepthModeKey === "echo") {
		controls.push(createChoiceRowMenuControlState({
			key: "depthEchoReactiveRow",
			label: "Sound-reactive",
			rowStyle: "checkbox",
			items: (uiState.echoReactiveControls || []).map(function(item) {
				return {
					key: item.key,
					label: item.label,
					checkedBool: !!item.checkedBool,
					hoveredBool: hasHoveredActionKey(args, "depthEchoReactive:" + item.key),
					action: {type: "depthEchoReactive.toggle", key: item.key},
					hoverKey: "depthEchoReactive:" + item.key
				};
			})
		}));
		if (uiState.echoReactiveIntensityVisibleBool) {
			appendDepthSliderControlByKey("depthEchoReactiveIntensity");
		}
		appendDepthSliderControlByKey("depthEchoPhase");
		appendDepthSliderControlByKey("depthEchoPhaseSpeed");
		appendDepthSliderControlByKey("depthEchoWavelength");
		appendDepthSliderControlByKey("depthEchoDutyCycle");
		appendDepthSliderControlByKey("depthEchoFade");
		appendDepthSliderControlByKey("depthMrRetain");
	} else {
		if (uiState.depthActiveBool && uiState.selectedDepthModeKey === "distance" && uiState.distanceReactiveControl) {
			controls.push(createCheckboxMenuControlState({
				key: "depthDistanceReactiveToggle",
				label: uiState.distanceReactiveControl.label || "Sound-reactive",
				valueText: uiState.distanceReactiveControl.checkedBool ? "On" : "Off",
				checkedBool: !!uiState.distanceReactiveControl.checkedBool,
				hoveredBool: hasHoveredActionKey(args, "depthDistanceReactiveToggle:toggle"),
				action: {type: "depthDistanceReactive.toggle"},
				hoverKey: "depthDistanceReactiveToggle:toggle"
			}));
			appendDepthSliderControlByKey("depthDistanceReactiveIntensity");
			appendDepthSliderControlByKey("depthThreshold");
			appendDepthSliderControlByKey("depthFade");
			appendDepthSliderControlByKey("depthMrRetain");
		} else {
			appendSliderMenuControls(controls, depthSliderControls);
		}
	}
	return createMenuSectionState({
		key: "passthrough",
		columnIndex: args.columnIndex,
		title: "Passthrough",
		statusText: uiState.statusText || "",
		statusTone: uiState.availableBool ? "muted" : "warning",
		controls: controls
	});
};

const createSceneLightingMenuSectionState = function(args) {
	args = args || {};
	const controls = [
		createCyclerMenuControlState({
			key: "sceneLightingMode",
			label: "Lighting Mode",
			valueText: getMenuModeLabelByKey(args.lightingModes, args.selectedLightingModeKey, "Uniform"),
			hoveredAction: getHoveredCyclerAction(args, "sceneLightingMode:prev", "sceneLightingMode:next"),
			prevAction: {type: "sceneLightingMode.cycle", direction: -1},
			nextAction: {type: "sceneLightingMode.cycle", direction: 1},
			prevHoverKey: "sceneLightingMode:prev",
			nextHoverKey: "sceneLightingMode:next"
		}),
		createCyclerMenuControlState({
			key: "sceneLightPreset",
			label: "Light Preset",
			valueText: args.currentLightPresetName || "Aurora Drift",
			metaText: args.currentLightPresetDescription || "",
			hoveredAction: getHoveredCyclerAction(args, "sceneLightPreset:prev", "sceneLightPreset:next"),
			prevAction: {type: "sceneLightPreset.cycle", direction: -1},
			nextAction: {type: "sceneLightPreset.cycle", direction: 1},
			prevHoverKey: "sceneLightPreset:prev",
			nextHoverKey: "sceneLightPreset:next"
		}),
		createCyclerMenuControlState({
			key: "sceneLightingAnchorMode",
			label: "World Anchor",
			valueText: getMenuModeLabelByKey(args.lightingAnchorModes, args.selectedLightingAnchorModeKey, "Auto"),
			metaText: getLightingAnchorModeMetaText(args.selectedLightingAnchorModeKey),
			hoveredAction: getHoveredCyclerAction(args, "sceneLightingAnchorMode:prev", "sceneLightingAnchorMode:next"),
			prevAction: {type: "sceneLightingAnchorMode.cycle", direction: -1},
			nextAction: {type: "sceneLightingAnchorMode.cycle", direction: 1},
			prevHoverKey: "sceneLightingAnchorMode:prev",
			nextHoverKey: "sceneLightingAnchorMode:next"
		})
	];
	appendSliderMenuControls(controls, args.sliderControls);
	return createMenuSectionState({
		key: "sceneLighting",
		columnIndex: args.columnIndex,
		title: "Scene Lighting",
		controls: controls
	});
};

const createLowerMenuSections = function(args) {
	args = args || {};
	// Lower interactive sections are composed here so xr-menu.js stays generic.
	return [
		createJumpModeMenuSectionState({
			selectedJumpMode: args.selectedJumpMode,
			hoveredActionKeys: args.hoveredActionKeys,
			columnIndex: 1
		}),
		createEyeDistanceMenuSectionState({
			value: args.eyeDistanceMeters,
			min: args.eyeDistanceMin,
			max: args.eyeDistanceMax,
			sliderT: args.eyeDistanceSliderT,
			hoveredBool: args.eyeDistanceHoverBool,
			activeBool: args.eyeDistanceActiveBool,
			columnIndex: 1
		}),
		createWorldOpacityMenuSectionState({
			value: args.floorAlpha,
			sliderT: args.floorAlphaSliderT,
			hoveredBool: args.floorAlphaHoverBool,
			activeBool: args.floorAlphaActiveBool,
			columnIndex: 1
		}),
		createBackgroundMenuSectionState({
			uiState: args.passthroughUiState,
			hoveredActionKeys: args.hoveredActionKeys,
			sliderControls: args.backgroundControls,
			columnIndex: 1
		}),
		createPassthroughMenuSectionState({
			uiState: args.passthroughUiState,
			hoveredActionKeys: args.hoveredActionKeys,
			sliderControls: args.passthroughControls,
			columnIndex: 2
		}),
		createSceneLightingMenuSectionState({
			lightingModes: args.lightingModes,
			lightingAnchorModes: args.lightingAnchorModes,
			selectedLightingModeKey: args.selectedLightingModeKey,
			selectedLightingAnchorModeKey: args.selectedLightingAnchorModeKey,
			hoveredActionKeys: args.hoveredActionKeys,
			currentLightPresetName: args.currentLightPresetName,
			currentLightPresetDescription: args.currentLightPresetDescription,
			sliderControls: args.sceneLightingControls,
			columnIndex: 2
		}),
		createVisualizerModeMenuSectionState({
			valueText: args.currentShaderModeName,
			metaText: args.shaderModeMetaText,
			hoveredActionKeys: args.hoveredActionKeys,
			horizontalMirrorBool: args.horizontalMirrorBool,
			checkboxValueText: args.horizontalMirrorBool ? "On" : "Off",
			columnIndex: 1
		}),
		createButterchurnPresetMenuSectionState({
			valueText: args.currentPresetName,
			metaText: args.presetMetaText,
			hoveredActionKeys: args.hoveredActionKeys,
			columnIndex: 1
		}),
		createSessionMenuSectionState({
			xrSessionActiveBool: !!args.xrSessionActiveBool,
			hoveredActionKeys: args.hoveredActionKeys,
			columnIndex: 1,
			footerBool: true
		})
	].filter(Boolean);
};

// TestLab sections
// TestLab uses a reduced menu so effect review stays focused.

const getTestLabAudioModeLabel = function(args) {
	args = args || {};
	if (args.audioSourceKind === "debug") {
		return "Debug";
	}
	if (args.audioSourceKind === "stream") {
		return args.audioSourceName ? "Live: " + args.audioSourceName : "Live";
	}
	return "None";
};

const createTestLabAudioBarItems = function(audioMetrics) {
	audioMetrics = audioMetrics || emptyAudioMetrics;
	return [
		{label: "Level", value: clampNumber(audioMetrics.level || 0, 0, 1)},
		{label: "Bass", value: clampNumber(audioMetrics.bass || 0, 0, 1)},
		{label: "Transient", value: clampNumber(audioMetrics.transient || 0, 0, 1)},
		{label: "Beat Pulse", value: clampNumber(audioMetrics.beatPulse || 0, 0, 1)},
		{label: "Strobe", value: clampNumber(audioMetrics.strobeGate || 0, 0, 1)},
		{label: "Left Hit", value: clampNumber(audioMetrics.leftImpact || 0, 0, 1)},
		{label: "Right Hit", value: clampNumber(audioMetrics.rightImpact || 0, 0, 1)}
	];
};

const createTestLabMenuSections = function(args) {
	args = args || {};
	const controls = [
		createCyclerMenuControlState({
			key: "sceneLightPreset",
			label: "Active Effect",
			valueText: args.currentLightPresetEffectName || args.currentLightPresetName || "Soft Wash",
			metaText: args.currentLightPresetEffectDescription || args.currentLightPresetDescription || "",
			hoveredAction: getHoveredCyclerAction(args, "sceneLightPreset:prev", "sceneLightPreset:next"),
			prevAction: {type: "sceneLightPreset.cycle", direction: -1},
			nextAction: {type: "sceneLightPreset.cycle", direction: 1},
			prevHoverKey: "sceneLightPreset:prev",
			nextHoverKey: "sceneLightPreset:next"
		}),
		createCyclerMenuControlState({
			key: "sceneLightingAnchorMode",
			label: "World Anchor",
			valueText: getMenuModeLabelByKey(args.lightingAnchorModes, args.selectedLightingAnchorModeKey, "Auto"),
			metaText: getLightingAnchorModeMetaText(args.selectedLightingAnchorModeKey),
			hoveredAction: getHoveredCyclerAction(args, "sceneLightingAnchorMode:prev", "sceneLightingAnchorMode:next"),
			prevAction: {type: "sceneLightingAnchorMode.cycle", direction: -1},
			nextAction: {type: "sceneLightingAnchorMode.cycle", direction: 1},
			prevHoverKey: "sceneLightingAnchorMode:prev",
			nextHoverKey: "sceneLightingAnchorMode:next"
		})
	];
	if (args.passthroughUiState && args.passthroughUiState.usableDepthAvailableBool) {
		controls.push(createCheckboxMenuControlState({
			key: "passthroughDepthToggle",
			label: "use Depth",
			valueText: args.passthroughUiState.depthActiveBool ? "using Depth" : "using fallback",
			checkedBool: !!args.passthroughUiState.depthActiveBool,
			hoveredBool: hasHoveredActionKey(args, "passthroughDepthToggle:toggle"),
			action: {type: "passthroughDepth.toggle"},
			hoverKey: "passthroughDepthToggle:toggle"
		}));
	}
	appendSliderMenuControls(controls, (args.sceneLightingControls || []).concat(args.effectSemanticControls || []));
	return [
		createMenuSectionState({
			key: "testLabEffect",
			title: "Effect Review",
			badgeText: ((args.currentLightPresetEffectIndex || 0) + 1) + " / " + (args.currentLightPresetEffectCount || 1),
			statusText: args.passthroughUiState && args.passthroughUiState.usableDepthAvailableBool ? (args.passthroughUiState.depthActiveBool ? "using Depth" : "using fallback") : "using fallback",
			controls: controls
		}),
		createMenuSectionState({
			key: "testLabIsolation",
			title: "Isolation",
			statusText: "Audio: " + getTestLabAudioModeLabel(args) + " | Baseline: Uniform / Manual / Mix 100%",
			controls: []
		}),
		createSessionMenuSectionState({
			xrSessionActiveBool: !!args.xrSessionActiveBool,
			hoveredActionKeys: args.hoveredActionKeys
		})
	].filter(Boolean);
};

// View
// app/menu.js
const createMenuView = function(options) {
	options = options || {};
	const emptyModeNames = ["No mode"];
	const emptyPresetNames = ["No preset"];
	const titleText = options.titleText || "VR Control Deck";
	const defaultWideMenuLayoutWidth = 2080;
	const menuWorldScale = options.menuWorldScale == null ? 1.25 : options.menuWorldScale;
	const multiColumnWorldWidthStep = options.multiColumnWorldWidthStep == null ? 0.22 : options.multiColumnWorldWidthStep;
	const buildAudioBarItems = options.getAudioBarItems || function(audioMetrics) {
		audioMetrics = audioMetrics || emptyAudioMetrics;
		return [
			{label: "Level", value: clampNumber(audioMetrics.level || 0, 0, 1)},
			{label: "Bass", value: clampNumber(audioMetrics.bass || 0, 0, 1)},
			{label: "Kick", value: clampNumber(audioMetrics.kickGate || 0, 0, 1)},
			{label: "Bass Hit", value: clampNumber(audioMetrics.bassHit || 0, 0, 1)},
			{label: "Transient", value: clampNumber(audioMetrics.transient || 0, 0, 1)},
			{label: "Beat Pulse", value: clampNumber(audioMetrics.beatPulse || 0, 0, 1)},
			{label: "Strobe", value: clampNumber(audioMetrics.strobeGate || 0, 0, 1)},
			{label: "Fill", value: clampNumber(audioMetrics.roomFill || 0, 0, 1)},
			{label: "Left Hit", value: clampNumber(audioMetrics.leftImpact || 0, 0, 1)},
			{label: "Right Hit", value: clampNumber(audioMetrics.rightImpact || 0, 0, 1)}
		];
	};
	const documentRef = options.documentRef || document;
	const previewParentElement = options.previewParentElement || options.parentElement || documentRef.body;
	const menuLayoutWidth = options.canvasWidth || defaultWideMenuLayoutWidth;
	const menuCanvas = documentRef.createElement("canvas");
	menuCanvas.width = menuLayoutWidth;
	menuCanvas.height = options.canvasHeight || 960;
	menuCanvas.setAttribute("role", "img");
	menuCanvas.setAttribute("aria-label", "VR menu interface");
	const menuCtx = menuCanvas.getContext("2d");
	const previewCanvas = documentRef.createElement("canvas");
	previewCanvas.setAttribute("role", "img");
	previewCanvas.setAttribute("aria-label", "Desktop menu preview");
	const previewCtx = previewCanvas.getContext("2d");
	const previewWidthPixels = options.desktopMenuPreviewWidthPixels || 800;
	previewCanvas.width = menuCanvas.width;
	previewCanvas.height = menuCanvas.height;
	applyStyles(previewCanvas, {
		position: "fixed",
		right: "12px",
		top: "12px",
		width: previewWidthPixels + "px",
		height: Math.round(previewWidthPixels * menuCanvas.height / menuLayoutWidth) + "px",
		border: "1px solid #ffff00",
		backgroundColor: "rgba(0, 0, 32, 0.92)",
		display: options.initialDesktopPreviewVisibleBool === false ? "none" : "block",
		pointerEvents: "auto",
		cursor: "pointer",
		zIndex: "20"
	});
	applyStyles(previewCanvas, options.previewStyle);
	previewParentElement.appendChild(previewCanvas);
	const getSectionPanelLayout = function(panelLeft, panelWidth, panelTop, section) {
		section = section || {};
		const controls = section.controls || [];
		let cursorY = panelTop + 72;
		const controlLayouts = [];
		for (let i = 0; i < controls.length; i += 1) {
			const control = controls[i];
			const controlLayout = {key: control.key, type: control.type};
			if (control.type === "cycler") {
				controlLayout.labelY = cursorY + 20;
				controlLayout.rowTop = cursorY + (control.label ? 28 : 4);
				controlLayout.rowHeight = 78;
				controlLayout.arrowButtonTop = controlLayout.rowTop - 10;
				controlLayout.arrowButtonHeight = controlLayout.rowHeight + 10;
				controlLayout.valueY = controlLayout.rowTop + 22;
				controlLayout.metaY = controlLayout.rowTop + 50;
				cursorY = controlLayout.arrowButtonTop + controlLayout.arrowButtonHeight + 10;
			}
			if (control.type === "choiceRow") {
				const checkboxRowBool = control.rowStyle === "checkbox";
				controlLayout.labelY = cursorY;
				controlLayout.rowTop = cursorY + (control.label ? 24 : 6);
				controlLayout.rowHeight = checkboxRowBool ? 54 : 70;
				cursorY = controlLayout.rowTop + controlLayout.rowHeight + (checkboxRowBool ? 14 : 16);
			}
			if (control.type === "checkbox") {
				controlLayout.labelY = cursorY;
				controlLayout.rowTop = cursorY + 8;
				controlLayout.rowHeight = 54;
				cursorY = controlLayout.rowTop + controlLayout.rowHeight + 14;
			}
			if (control.type === "slider") {
				controlLayout.trackY = cursorY + 30;
				controlLayout.labelY = controlLayout.trackY;
				controlLayout.hitTop = controlLayout.trackY - 36;
				controlLayout.hitBottom = controlLayout.trackY + 36;
				cursorY = controlLayout.hitBottom + 4;
			}
			controlLayouts.push(controlLayout);
		}
		const statusY = section.statusText ? cursorY + 2 : -1000;
		if (section.statusText) {
			cursorY = statusY + 18;
		}
		return {
			key: section.key,
			panelLeft: panelLeft,
			panelWidth: panelWidth,
			panelRight: panelLeft + panelWidth,
			centerX: panelLeft + panelWidth * 0.5,
			panelTop: panelTop,
			panelHeight: cursorY - panelTop + 18,
			titleY: panelTop + 38,
			badgeY: panelTop + 38,
			statusY: statusY,
			controlLayouts: controlLayouts
		};
	};
	const getColumnSectionLayouts = function(menuSections, startTop, sectionGap, panelLeft, panelWidth) {
		const layouts = [];
		const layoutByKey = {};
		const controlLayoutByKey = {};
		let currentTop = startTop;
		for (let i = 0; i < menuSections.length; i += 1) {
			const sectionLayout = getSectionPanelLayout(panelLeft, panelWidth, currentTop, menuSections[i]);
			layouts.push(sectionLayout);
			layoutByKey[menuSections[i].key] = sectionLayout;
			for (let j = 0; j < sectionLayout.controlLayouts.length; j += 1) {
				if (!sectionLayout.controlLayouts[j].key) {
					continue;
				}
				controlLayoutByKey[sectionLayout.controlLayouts[j].key] = {
					sectionLayout: sectionLayout,
					controlLayout: sectionLayout.controlLayouts[j]
				};
			}
			currentTop += sectionLayout.panelHeight + sectionGap;
		}
		return {
			layouts: layouts,
			layoutByKey: layoutByKey,
			controlLayoutByKey: controlLayoutByKey,
			nextTop: currentTop
		};
	};
	const getCyclerGeometry = function(sectionLayout) {
		const edgeInset = 18;
		const buttonWidth = Math.min(96, Math.max(74, sectionLayout.panelWidth * 0.16));
		return {
			prevX: sectionLayout.panelLeft + edgeInset,
			prevWidth: buttonWidth,
			nextX: sectionLayout.panelRight - edgeInset - buttonWidth,
			nextWidth: buttonWidth,
			centerX: sectionLayout.centerX
		};
	};
	const getChoiceRowGeometry = function(sectionLayout, control) {
		const rowInset = 18;
		const items = control.items || [];
		const checkboxRowBool = control.rowStyle === "checkbox";
		const rowStartX = sectionLayout.panelLeft + rowInset;
		const rowEndX = sectionLayout.panelRight - rowInset;
		const rowWidth = rowEndX - rowStartX;
		const gap = checkboxRowBool ? 18 : 26;
		const buttonWidth = (rowWidth - gap * Math.max(0, items.length - 1)) / Math.max(1, items.length);
		return {
			rowStartX: rowStartX,
			rowEndX: rowEndX,
			rowWidth: rowWidth,
			gap: gap,
			buttonWidth: buttonWidth
		};
	};
	const getCheckboxGeometry = function(sectionLayout) {
		const rowInset = 18;
		return {
			rowStartX: sectionLayout.panelLeft + rowInset,
			rowEndX: sectionLayout.panelRight - rowInset,
			rowWidth: sectionLayout.panelWidth - rowInset * 2
		};
	};
	const getSliderTrackGeometry = function(sectionLayout) {
		const trackInset = Math.max(78, sectionLayout.panelWidth * 0.16);
		return {
			trackStartX: sectionLayout.panelLeft + trackInset,
			trackEndX: sectionLayout.panelRight - trackInset
		};
	};
	const getSliderKnobX = function(sectionLayout, sliderT) {
		const sliderTrack = getSliderTrackGeometry(sectionLayout);
		return sliderTrack.trackStartX + clampNumber(sliderT, 0, 1) * (sliderTrack.trackEndX - sliderTrack.trackStartX);
	};
	const getSliderTFromCanvasX = function(sectionLayout, x) {
		const sliderTrack = getSliderTrackGeometry(sectionLayout);
		return clampNumber((x - sliderTrack.trackStartX) / (sliderTrack.trackEndX - sliderTrack.trackStartX), 0, 1);
	};
	const getSliderTForControlAtCanvasX = function(layout, controlKey, x) {
		const controlEntry = layout.controlLayoutByKey[controlKey];
		if (!controlEntry || !controlEntry.sectionLayout) {
			return clampNumber(x / menuLayoutWidth, 0, 1);
		}
		return getSliderTFromCanvasX(controlEntry.sectionLayout, x);
	};
	let cachedLayoutKey = "";
	let cachedLayoutResult = null;
	const buildLayoutCacheKey = function(menuSections) {
		let key = menuSections.length + ":";
		for (let i = 0; i < menuSections.length; i += 1) {
			const controls = menuSections[i].controls || [];
			key += menuSections[i].key + menuSections[i].columnIndex + (menuSections[i].footerBool ? "f" : "c") + controls.length;
			for (let ci = 0; ci < controls.length; ci += 1) {
				key += controls[ci].type || "";
			}
			key += "|";
		}
		return key;
	};
	const getLayoutMetrics = function(menuSections) {
		menuSections = menuSections || [];
		const layoutKey = buildLayoutCacheKey(menuSections);
		if (layoutKey === cachedLayoutKey && cachedLayoutResult) {
			cachedLayoutResult.menuSections = menuSections;
			return cachedLayoutResult;
		}
		const audioBarItems = buildAudioBarItems(emptyAudioMetrics).length;
		const audioPanelTop = 108;
		const audioBarTop = 116;
		const audioBarSpacing = 12;
		const audioPanelHeight = (audioBarTop - audioPanelTop) + (audioBarItems - 1) * audioBarSpacing + 18;
		const sectionGap = 12;
		const lowerStartTop = audioPanelTop + audioPanelHeight + sectionGap;
		const columnSections = [];
		const footerSections = [];
		let columnCount = 1;
		for (let i = 0; i < menuSections.length; i += 1) {
			if (menuSections[i].footerBool) {
				footerSections.push(menuSections[i]);
				continue;
			}
			columnSections.push(menuSections[i]);
			columnCount = Math.max(columnCount, menuSections[i].columnIndex == null ? 1 : menuSections[i].columnIndex);
		}
		const innerFrameInset = 24;
		const contentLeft = innerFrameInset + 18;
		const contentRight = menuLayoutWidth - innerFrameInset - 18;
		const contentWidth = contentRight - contentLeft;
		const columnGap = columnCount > 1 ? 24 : 0;
		const columnWidth = (contentWidth - columnGap * Math.max(0, columnCount - 1)) / Math.max(1, columnCount);
		const columnLayouts = [];
		const sectionLayoutByKey = {};
		const controlLayoutByKey = {};
		const sectionLayouts = [];
		let columnBottom = audioPanelTop + audioPanelHeight;
		for (let columnIndex = 1; columnIndex <= columnCount; columnIndex += 1) {
			const columnSectionsForIndex = columnSections.filter(function(section) {
				return (section.columnIndex == null ? 1 : section.columnIndex) === columnIndex;
			});
			const columnLayout = getColumnSectionLayouts(
				columnSectionsForIndex,
				lowerStartTop,
				sectionGap,
				contentLeft + (columnIndex - 1) * (columnWidth + columnGap),
				columnWidth
			);
			columnLayouts.push(columnLayout);
			columnBottom = Math.max(columnBottom, columnLayout.layouts.length ? columnLayout.layouts[columnLayout.layouts.length - 1].panelTop + columnLayout.layouts[columnLayout.layouts.length - 1].panelHeight : audioPanelTop + audioPanelHeight);
			Object.assign(sectionLayoutByKey, columnLayout.layoutByKey);
			Object.assign(controlLayoutByKey, columnLayout.controlLayoutByKey);
			Array.prototype.push.apply(sectionLayouts, columnLayout.layouts);
		}
		const footerStartTop = footerSections.length ? columnBottom + sectionGap : columnBottom;
		const footerLayout = footerSections.length ? getColumnSectionLayouts(footerSections, footerStartTop, sectionGap, contentLeft, contentWidth) : {
			layouts: [],
			layoutByKey: {},
			controlLayoutByKey: {},
			nextTop: footerStartTop
		};
		const sliderReachPadPx = 28;
		const footerBottom = footerLayout.layouts.length ? footerLayout.layouts[footerLayout.layouts.length - 1].panelTop + footerLayout.layouts[footerLayout.layouts.length - 1].panelHeight : columnBottom;
		const lastSectionBottom = Math.max(columnBottom, footerBottom);
		const canvasHeight = Math.ceil(lastSectionBottom + 30 + sectionGap);
		Object.assign(sectionLayoutByKey, footerLayout.layoutByKey);
		Object.assign(controlLayoutByKey, footerLayout.controlLayoutByKey);
		Array.prototype.push.apply(sectionLayouts, footerLayout.layouts);
		cachedLayoutResult = Object.assign({
			contentLeft: contentLeft,
			contentWidth: contentWidth,
			contentRight: contentRight,
			canvasHeight: canvasHeight,
			audioPanelTop: audioPanelTop,
			audioBarTop: audioBarTop,
			audioBarSpacing: audioBarSpacing,
			audioPanelHeight: audioPanelHeight,
			centerX: menuLayoutWidth * 0.5,
			columnCount: columnCount,
			columnGap: columnGap,
			columnWidth: columnWidth,
			sliderReachPadPx: sliderReachPadPx,
			sliderHalfHeightPx: options.menuSliderHalfHeight * canvasHeight,
			menuSections: menuSections,
			sectionLayoutByKey: sectionLayoutByKey,
			controlLayoutByKey: controlLayoutByKey,
			sectionLayouts: sectionLayouts
		});
		cachedLayoutKey = layoutKey;
		return cachedLayoutResult;
	};
	const syncCanvasSize = function(layout) {
		const targetHeight = layout.canvasHeight;
		if (menuCanvas.height !== targetHeight) {
			menuCanvas.height = targetHeight;
		}
		if (previewCanvas.width !== menuCanvas.width || previewCanvas.height !== targetHeight) {
			previewCanvas.width = menuCanvas.width;
			previewCanvas.height = targetHeight;
		}
		applyStyles(previewCanvas, {
			width: previewWidthPixels + "px",
			height: Math.round(previewWidthPixels * targetHeight / menuLayoutWidth) + "px"
		});
	};
	const getMenuPlaneDimensions = function(menuSections) {
		const layout = getLayoutMetrics(menuSections);
		const worldMenuWidth = (options.menuWorldWidth || options.menuWidth || 0.74) * menuWorldScale * (1 + Math.max(0, layout.columnCount - 1) * multiColumnWorldWidthStep);
		return {
			width: worldMenuWidth,
			height: worldMenuWidth * (layout.canvasHeight / menuLayoutWidth)
		};
	};
	const drawCenteredFittedText = function(text, centerX, topY, maxWidth, fontSize, minFontSize, color, weight) {
		let currentFontSize = fontSize;
		while (currentFontSize > minFontSize) {
			menuCtx.font = (weight || "") + " " + currentFontSize + "px Arial";
			if (menuCtx.measureText(text).width <= maxWidth) { break; }
			currentFontSize -= 2;
		}
		menuCtx.font = (weight || "") + " " + currentFontSize + "px Arial";
		menuCtx.fillStyle = color;
		menuCtx.fillText(text, centerX, topY);
	};
	const getSectionInteraction = function(layout, x, y) {
		let action = null;
		let hoverKey = "";
		let moduleSliderControlKey = "";
		let sliderT = 0;
		for (let i = 0; i < layout.menuSections.length; i += 1) {
			const section = layout.menuSections[i];
			const sectionLayout = layout.sectionLayoutByKey[section.key];
			if (!sectionLayout) {
				continue;
			}
			for (let j = 0; j < sectionLayout.controlLayouts.length; j += 1) {
				const controlLayout = sectionLayout.controlLayouts[j];
				const control = section.controls[j];
				if (control.type === "cycler" && y >= controlLayout.arrowButtonTop && y <= controlLayout.arrowButtonTop + controlLayout.arrowButtonHeight) {
					const cyclerGeometry = getCyclerGeometry(sectionLayout);
					if (x >= cyclerGeometry.prevX && x <= cyclerGeometry.prevX + cyclerGeometry.prevWidth) {
						action = control.prevAction || null;
						hoverKey = control.prevHoverKey || "";
					} else if (x >= cyclerGeometry.nextX && x <= cyclerGeometry.nextX + cyclerGeometry.nextWidth) {
						action = control.nextAction || null;
						hoverKey = control.nextHoverKey || "";
					}
				}
				if (control.type === "choiceRow" && y >= controlLayout.rowTop && y <= controlLayout.rowTop + controlLayout.rowHeight) {
					const items = control.items || [];
					const rowGeometry = getChoiceRowGeometry(sectionLayout, control);
					for (let k = 0; k < items.length; k += 1) {
						const itemX = rowGeometry.rowStartX + k * (rowGeometry.buttonWidth + rowGeometry.gap);
						if (x >= itemX && x <= itemX + rowGeometry.buttonWidth) {
							action = items[k].action || null;
							hoverKey = items[k].hoverKey || "";
						}
					}
				}
				if (control.type === "checkbox") {
					const checkboxGeometry = getCheckboxGeometry(sectionLayout);
					if (y >= controlLayout.rowTop && y <= controlLayout.rowTop + controlLayout.rowHeight && x >= checkboxGeometry.rowStartX && x <= checkboxGeometry.rowEndX) {
						action = control.action || null;
						hoverKey = control.hoverKey || "";
					}
				}
				if (control.type === "slider") {
					const sliderTrack = getSliderTrackGeometry(sectionLayout);
					if (y >= controlLayout.hitTop && y <= controlLayout.hitBottom && x >= sliderTrack.trackStartX - 20 && x <= sliderTrack.trackEndX + 20) {
						moduleSliderControlKey = control.sliderKey || control.key;
						sliderT = getSliderTFromCanvasX(sectionLayout, x);
						hoverKey = control.hoverKey || moduleSliderControlKey;
					}
				}
			}
		}
		if (moduleSliderControlKey) {
			action = null;
		}
		return {
			action: action,
			hoverKey: hoverKey,
			moduleSliderControlKey: moduleSliderControlKey,
			sliderT: moduleSliderControlKey ? sliderT : 0,
			u: clampNumber(x / menuLayoutWidth, 0, 1)
		};
	};
	return {
		menuCanvas: menuCanvas,
		previewCanvas: previewCanvas,
		getPlaneDimensions: function(moduleSections) {
			return getMenuPlaneDimensions(moduleSections);
		},
		getInteractionAtUv: function(u, v, moduleSections) {
			const layout = getLayoutMetrics(moduleSections);
			const x = u * menuLayoutWidth;
			const interaction = getSectionInteraction(layout, x, v * layout.canvasHeight);
			if (!interaction.moduleSliderControlKey) {
				interaction.u = clampNumber(u, 0, 1);
			}
			return interaction;
		},
		getSliderTAtUv: function(u, v, moduleSections, controlKey) {
			const layout = getLayoutMetrics(moduleSections);
			return getSliderTForControlAtCanvasX(layout, controlKey, u * menuLayoutWidth);
		},
		render: function(renderState) {
			renderState = renderState || {};
			const moduleSections = renderState.moduleSections || [];
			const layout = getLayoutMetrics(moduleSections);
			const audioMetrics = renderState.audioMetrics || {};
			const accentRgb = hslToRgb((renderState.sceneTimeSeconds || 0) * 0.03 + 0.04, 0.85, 0.62);
			const accentColor = "rgb(" + Math.round(accentRgb[0] * 255) + "," + Math.round(accentRgb[1] * 255) + "," + Math.round(accentRgb[2] * 255) + ")";
			const accentSoft = "rgba(" + Math.round(accentRgb[0] * 255) + "," + Math.round(accentRgb[1] * 255) + "," + Math.round(accentRgb[2] * 255) + ",0.18)";
			const audioBarItems = buildAudioBarItems(audioMetrics);
			syncCanvasSize(layout);
			menuCtx.setTransform(1, 0, 0, 1, 0, 0);
			menuCtx.clearRect(0, 0, menuCanvas.width, menuCanvas.height);
			menuCtx.setTransform(1, 0, 0, 1, 0, 0);
			const headerGradient = menuCtx.createLinearGradient(0, 0, menuLayoutWidth, layout.canvasHeight);
			headerGradient.addColorStop(0, "#04111f");
			headerGradient.addColorStop(0.55, "#071d33");
			headerGradient.addColorStop(1, "#160c2f");
			menuCtx.fillStyle = headerGradient;
			menuCtx.fillRect(0, 0, menuLayoutWidth, layout.canvasHeight);
			menuCtx.fillStyle = "rgba(255,255,255,0.025)";
			for (let i = 0; i < 24; i += 1) {
				menuCtx.fillRect((i * 73 + (renderState.sceneTimeSeconds || 0) * 28) % (menuLayoutWidth + 40) - 40, 0, 18, layout.canvasHeight);
			}
			menuCtx.fillStyle = accentSoft;
			menuCtx.beginPath();
			menuCtx.arc(menuLayoutWidth * 0.18, layout.canvasHeight * 0.14, 160, 0, Math.PI * 2);
			menuCtx.fill();
			menuCtx.beginPath();
			menuCtx.arc(menuLayoutWidth * 0.84, layout.canvasHeight * 0.24, 210, 0, Math.PI * 2);
			menuCtx.fill();
			menuCtx.strokeStyle = "rgba(255,255,255,0.18)";
			menuCtx.lineWidth = 2;
			menuCtx.strokeRect(14, 14, menuLayoutWidth - 28, layout.canvasHeight - 28);
			menuCtx.strokeStyle = accentColor;
			menuCtx.lineWidth = 4;
			menuCtx.strokeRect(24, 24, menuLayoutWidth - 48, layout.canvasHeight - 48);
			menuCtx.textAlign = "left";
			menuCtx.textBaseline = "top";
			menuCtx.fillStyle = "#f8fbff";
			menuCtx.font = "bold 46px Arial";
			menuCtx.fillText(titleText, layout.contentLeft, 34);
			menuCtx.fillStyle = accentSoft;
			menuCtx.fillRect(layout.contentLeft, layout.audioPanelTop, layout.contentWidth, layout.audioPanelHeight);
			menuCtx.strokeStyle = "rgba(255,255,255,0.18)";
			menuCtx.lineWidth = 2;
			menuCtx.strokeRect(layout.contentLeft, layout.audioPanelTop, layout.contentWidth, layout.audioPanelHeight);
			const audioBarStartX = layout.contentLeft + 150;
			const audioBarWidth = layout.contentWidth - 230;
			for (let i = 0; i < audioBarItems.length; i += 1) {
				const item = audioBarItems[i];
				const rowY = layout.audioBarTop + i * layout.audioBarSpacing;
				menuCtx.textAlign = "left";
				menuCtx.fillStyle = "#ffffff";
				menuCtx.font = "bold 15px Arial";
				menuCtx.fillText(item.label, layout.contentLeft + 18, rowY);
				menuCtx.fillStyle = "rgba(255,255,255,0.14)";
				menuCtx.fillRect(audioBarStartX, rowY + 2, audioBarWidth, 7);
				menuCtx.fillStyle = accentColor;
				menuCtx.fillRect(audioBarStartX, rowY + 2, audioBarWidth * item.value, 7);
				menuCtx.strokeStyle = "rgba(255,255,255,0.18)";
				menuCtx.lineWidth = 1;
				menuCtx.strokeRect(audioBarStartX, rowY + 2, audioBarWidth, 7);
				menuCtx.textAlign = "right";
				menuCtx.fillStyle = accentColor;
				menuCtx.fillText(Math.round(item.value * 100) + "%", layout.contentRight - 16, rowY);
			}
			const drawChoiceRow = function(sectionLayout, control, controlLayout) {
				const items = control.items || [];
				const checkboxRowBool = control.rowStyle === "checkbox";
				const rowGeometry = getChoiceRowGeometry(sectionLayout, control);
				for (let i = 0; i < items.length; i += 1) {
					const item = items[i];
					const itemX = rowGeometry.rowStartX + i * (rowGeometry.buttonWidth + rowGeometry.gap);
					if (checkboxRowBool) {
						const boxSize = 28;
						const boxX = itemX + 14;
						const boxY = controlLayout.rowTop + (controlLayout.rowHeight - boxSize) * 0.5;
						const rowCenterY = controlLayout.rowTop + controlLayout.rowHeight * 0.5;
						menuCtx.fillStyle = item.hoveredBool ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.1)";
						menuCtx.fillRect(itemX, controlLayout.rowTop, rowGeometry.buttonWidth, controlLayout.rowHeight);
						menuCtx.strokeStyle = "rgba(255,255,255,0.15)";
						menuCtx.lineWidth = 2;
						menuCtx.strokeRect(itemX, controlLayout.rowTop, rowGeometry.buttonWidth, controlLayout.rowHeight);
						menuCtx.fillStyle = item.checkedBool ? accentSoft : "rgba(255,255,255,0.08)";
						menuCtx.fillRect(boxX, boxY, boxSize, boxSize);
						menuCtx.strokeStyle = item.hoveredBool || item.checkedBool ? accentColor : "rgba(255,255,255,0.35)";
						menuCtx.lineWidth = 3;
						menuCtx.strokeRect(boxX, boxY, boxSize, boxSize);
						if (item.checkedBool) {
							menuCtx.strokeStyle = accentColor;
							menuCtx.lineWidth = 4;
							menuCtx.beginPath();
							menuCtx.moveTo(boxX + 6, boxY + 15);
							menuCtx.lineTo(boxX + 12, boxY + 22);
							menuCtx.lineTo(boxX + 22, boxY + 8);
							menuCtx.stroke();
						}
						menuCtx.textBaseline = "middle";
						menuCtx.textAlign = "left";
						menuCtx.fillStyle = "#ffffff";
						menuCtx.font = "bold 22px Arial";
						menuCtx.fillText(item.label, boxX + boxSize + 14, rowCenterY);
						if (item.valueText) {
							menuCtx.textAlign = "right";
							menuCtx.fillStyle = accentColor;
							menuCtx.font = "bold 18px Arial";
							menuCtx.fillText(item.valueText, itemX + rowGeometry.buttonWidth - 14, rowCenterY);
						}
					} else {
						menuCtx.textBaseline = "top";
						menuCtx.fillStyle = item.selectedBool ? accentSoft : item.hoveredBool ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.12)";
						menuCtx.fillRect(itemX, controlLayout.rowTop, rowGeometry.buttonWidth, controlLayout.rowHeight);
						menuCtx.strokeStyle = "rgba(255,255,255,0.18)";
						menuCtx.lineWidth = 2;
						menuCtx.strokeRect(itemX, controlLayout.rowTop, rowGeometry.buttonWidth, controlLayout.rowHeight);
						menuCtx.fillStyle = "#ffffff";
						menuCtx.font = "bold 30px Arial";
						menuCtx.textAlign = "center";
						menuCtx.fillText(item.label, itemX + rowGeometry.buttonWidth * 0.5, controlLayout.rowTop + 16);
						if (item.metaText) {
							menuCtx.fillStyle = "rgba(255,255,255,0.7)";
							menuCtx.font = "20px Arial";
							menuCtx.fillText(item.metaText, itemX + rowGeometry.buttonWidth * 0.5, controlLayout.rowTop + 48);
						}
					}
				}
				menuCtx.textAlign = "left";
				menuCtx.textBaseline = "top";
			};
			const drawDynamicSection = function(section) {
				const sectionLayout = layout.sectionLayoutByKey[section.key];
				if (!sectionLayout) {
					return;
				}
				menuCtx.textAlign = "left";
				menuCtx.fillStyle = "rgba(6,14,24,0.82)";
				menuCtx.fillRect(sectionLayout.panelLeft, sectionLayout.panelTop, sectionLayout.panelWidth, sectionLayout.panelHeight);
				menuCtx.strokeStyle = "rgba(255,255,255,0.15)";
				menuCtx.lineWidth = 2;
				menuCtx.strokeRect(sectionLayout.panelLeft, sectionLayout.panelTop, sectionLayout.panelWidth, sectionLayout.panelHeight);
				menuCtx.textBaseline = "middle";
				menuCtx.fillStyle = "#ffffff";
				menuCtx.font = "bold 30px Arial";
				menuCtx.fillText(section.title, sectionLayout.panelLeft + 28, sectionLayout.titleY);
				if (section.badgeText) {
					menuCtx.textAlign = "right";
					menuCtx.fillStyle = accentColor;
					menuCtx.fillText(section.badgeText, sectionLayout.panelRight - 28, sectionLayout.badgeY);
					menuCtx.textAlign = "left";
				}
				menuCtx.textBaseline = "top";
				for (let i = 0; i < section.controls.length; i += 1) {
					const control = section.controls[i];
					const controlLayout = sectionLayout.controlLayouts[i];
					if (control.type === "cycler") {
						const cyclerGeometry = getCyclerGeometry(sectionLayout);
						menuCtx.textBaseline = "top";
						if (control.label) {
							menuCtx.fillStyle = "rgba(255,255,255,0.82)";
							menuCtx.font = "bold 20px Arial";
							menuCtx.textAlign = "center";
							menuCtx.fillText(control.label, sectionLayout.centerX, controlLayout.labelY);
						}
						menuCtx.fillStyle = control.hoveredAction === "prev" ? accentSoft : "rgba(255,255,255,0.12)";
						menuCtx.fillRect(cyclerGeometry.prevX, controlLayout.arrowButtonTop, cyclerGeometry.prevWidth, controlLayout.arrowButtonHeight);
						menuCtx.strokeStyle = "rgba(255,255,255,0.18)";
						menuCtx.lineWidth = 2;
						menuCtx.strokeRect(cyclerGeometry.prevX, controlLayout.arrowButtonTop, cyclerGeometry.prevWidth, controlLayout.arrowButtonHeight);
						menuCtx.fillStyle = control.hoveredAction === "next" ? accentSoft : "rgba(255,255,255,0.12)";
						menuCtx.fillRect(cyclerGeometry.nextX, controlLayout.arrowButtonTop, cyclerGeometry.nextWidth, controlLayout.arrowButtonHeight);
						menuCtx.strokeRect(cyclerGeometry.nextX, controlLayout.arrowButtonTop, cyclerGeometry.nextWidth, controlLayout.arrowButtonHeight);
						menuCtx.fillStyle = "#ffffff";
						menuCtx.font = "bold 44px Arial";
						menuCtx.textAlign = "center";
						menuCtx.fillText("<", cyclerGeometry.prevX + cyclerGeometry.prevWidth * 0.5, controlLayout.rowTop + 14);
						menuCtx.fillText(">", cyclerGeometry.nextX + cyclerGeometry.nextWidth * 0.5, controlLayout.rowTop + 14);
						drawCenteredFittedText(control.valueText || "", sectionLayout.centerX, controlLayout.valueY, sectionLayout.panelWidth * 0.46, 28, 18, "#ffffff", "bold");
						if (control.metaText) {
							drawCenteredFittedText(control.metaText, sectionLayout.centerX, controlLayout.metaY, sectionLayout.panelWidth * 0.66, 18, 14, "rgba(255,255,255,0.65)");
						}
						menuCtx.textAlign = "left";
					}
					if (control.type === "choiceRow") {
						if (control.label) {
							menuCtx.fillStyle = "#ffffff";
							menuCtx.font = "bold 24px Arial";
							menuCtx.fillText(control.label, sectionLayout.panelLeft + 28, controlLayout.labelY);
						}
						drawChoiceRow(sectionLayout, control, controlLayout);
					}
					if (control.type === "checkbox") {
						const checkboxGeometry = getCheckboxGeometry(sectionLayout);
						const boxSize = 34;
						const boxX = checkboxGeometry.rowStartX + 18;
						const boxY = controlLayout.rowTop + 10;
						const rowCenterY = controlLayout.rowTop + controlLayout.rowHeight * 0.5;
						menuCtx.fillStyle = control.hoveredBool ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.1)";
						menuCtx.fillRect(checkboxGeometry.rowStartX, controlLayout.rowTop, checkboxGeometry.rowWidth, controlLayout.rowHeight);
						menuCtx.strokeStyle = "rgba(255,255,255,0.15)";
						menuCtx.lineWidth = 2;
						menuCtx.strokeRect(checkboxGeometry.rowStartX, controlLayout.rowTop, checkboxGeometry.rowWidth, controlLayout.rowHeight);
						menuCtx.fillStyle = control.checkedBool ? accentSoft : "rgba(255,255,255,0.08)";
						menuCtx.fillRect(boxX, boxY, boxSize, boxSize);
						menuCtx.strokeStyle = control.hoveredBool || control.checkedBool ? accentColor : "rgba(255,255,255,0.35)";
						menuCtx.lineWidth = 3;
						menuCtx.strokeRect(boxX, boxY, boxSize, boxSize);
						if (control.checkedBool) {
							menuCtx.strokeStyle = accentColor;
							menuCtx.lineWidth = 4;
							menuCtx.beginPath();
							menuCtx.moveTo(boxX + 7, boxY + 18);
							menuCtx.lineTo(boxX + 15, boxY + 27);
							menuCtx.lineTo(boxX + 28, boxY + 9);
							menuCtx.stroke();
						}
						menuCtx.textBaseline = "middle";
						menuCtx.textAlign = "left";
						menuCtx.fillStyle = "#ffffff";
						menuCtx.font = "bold 24px Arial";
						menuCtx.fillText(control.label, boxX + boxSize + 20, rowCenterY);
						if (control.valueText) {
							menuCtx.textAlign = "right";
							menuCtx.fillStyle = accentColor;
							menuCtx.font = "bold 22px Arial";
							menuCtx.fillText(control.valueText, checkboxGeometry.rowEndX - 18, rowCenterY);
							menuCtx.textAlign = "left";
						}
						menuCtx.textBaseline = "top";
					}
					if (control.type === "slider") {
						const sliderTrack = getSliderTrackGeometry(sectionLayout);
						const knobX = getSliderKnobX(sectionLayout, control.sliderT);
						if (control.label || control.valueText) {
							menuCtx.textBaseline = "middle";
							menuCtx.fillStyle = "#ffffff";
							menuCtx.font = "bold 24px Arial";
							menuCtx.textAlign = "left";
							menuCtx.fillText(control.label, sectionLayout.panelLeft + 28, controlLayout.trackY);
							menuCtx.textAlign = "right";
							menuCtx.fillStyle = accentColor;
							menuCtx.fillText(control.valueText || "", sectionLayout.panelRight - 28, controlLayout.trackY);
							menuCtx.textBaseline = "top";
						}
						menuCtx.strokeStyle = "rgba(255,255,255,0.14)";
						menuCtx.lineWidth = 18;
						menuCtx.beginPath();
						menuCtx.moveTo(sliderTrack.trackStartX, controlLayout.trackY);
						menuCtx.lineTo(sliderTrack.trackEndX, controlLayout.trackY);
						menuCtx.stroke();
						menuCtx.strokeStyle = accentColor;
						menuCtx.lineWidth = 10;
						menuCtx.beginPath();
						menuCtx.moveTo(sliderTrack.trackStartX, controlLayout.trackY);
						menuCtx.lineTo(sliderTrack.trackEndX, controlLayout.trackY);
						menuCtx.stroke();
						menuCtx.fillStyle = control.hoveredBool || control.activeBool ? accentColor : "#ffffff";
						menuCtx.beginPath();
						menuCtx.arc(knobX, controlLayout.trackY, 22, 0, Math.PI * 2);
						menuCtx.fill();
						menuCtx.fillStyle = "rgba(255,255,255,0.65)";
						menuCtx.font = "18px Arial";
						menuCtx.textBaseline = "top";
						menuCtx.textAlign = "left";
						menuCtx.fillText(control.minLabel || "", sliderTrack.trackStartX, controlLayout.trackY + 24);
						menuCtx.textAlign = "right";
						menuCtx.fillText(control.maxLabel || "", sliderTrack.trackEndX, controlLayout.trackY + 24);
						menuCtx.textBaseline = "top";
						menuCtx.textAlign = "left";
					}
				}
				if (section.statusText) {
					menuCtx.textAlign = "center";
					menuCtx.fillStyle = section.statusTone === "warning" ? "rgba(255,160,160,0.9)" : "rgba(255,255,255,0.68)";
					menuCtx.font = "18px Arial";
					menuCtx.textBaseline = "top";
					menuCtx.fillText(section.statusText, sectionLayout.centerX, sectionLayout.statusY);
					menuCtx.textAlign = "left";
				}
			};
			for (let i = 0; i < moduleSections.length; i += 1) {
				drawDynamicSection(moduleSections[i]);
			}
			menuCtx.setTransform(1, 0, 0, 1, 0, 0);
			return menuCanvas;
		},
		updateDesktopPreview: function(previewState) {
			previewState = previewState || {};
			if (!previewState.visibleBool) {
				previewCanvas.style.display = "none";
				return;
			}
			this.render(previewState.renderState);
			previewCanvas.style.display = "block";
			previewCanvas.style.pointerEvents = previewState.interactiveBool ? "auto" : "none";
			previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
			previewCtx.drawImage(menuCanvas, 0, 0);
		}
	};
};

const DEFAULT_MENU_PASSTHROUGH_UI_STATE = {
	availableBool: false,
	fallbackBool: true,
	statusText: "Passthrough unsupported, using black fallback",
	mixModes: backgroundMixModeDefinitions,
	selectedMixModeKey: "manual",
	mixModeVisibleBool: true,
	backgroundControls: [],
	flashlightActiveBool: false,
	depthActiveBool: false,
	depthRadialBool: true,

	depthModes: passthroughDepthModeDefinitions,
	selectedDepthModeKey: "distance",
	usableDepthAvailableBool: false,
	passthroughControls: [],
	distanceReactiveControl: null,
	echoReactiveControls: [],
	echoReactiveIntensityVisibleBool: false,
	lightingModes: passthroughLightingModeDefinitions,
	lightingAnchorModes: passthroughLightingAnchorModeDefinitions,
	selectedLightingModeKey: "uniform",
	selectedLightingAnchorModeKey: "auto",
	lightingControls: [],
	effectSemanticControls: [],
	visibleShare: 0
};


// Controller
const createMenuController = function(options) {
	const menuView = options.menuView;
	const buildModuleSections = options.buildModuleSections || createLowerMenuSections;
	const menuCanvas = menuView.menuCanvas;
	const previewCanvas = menuView.previewCanvas;
	const windowRef = options.windowRef || window;
	const passthroughController = options.passthroughController || null;
	const menuEventRegistry = createEventListenerRegistry();
	const controllerRays = [];
	const triggerPressedByHand = new Map();
	const state = {
		jumpMode: options.initialJumpMode || "double",
		menuOpenBool: false,
		menuTogglePressedBool: false,
		menuConsumesRightTriggerBool: false,
		floorAlpha: options.initialFloorAlpha == null ? 0.72 : options.initialFloorAlpha,
		eyeDistanceMeters: options.initialEyeDistanceMeters == null ? 0.064 : options.initialEyeDistanceMeters,
		activeSliderHand: "",
		activeFloorAlphaSliderHand: "",
		activeMenuSliderControlKeyByHand: {},
		hoveredActionKeys: {},
		xrSessionActiveBool: false,
		desktopPreviewVisibleBool: options.initialDesktopPreviewVisibleBool !== false,
		desktopPointerActiveBool: false,
		desktopPointerU: 0,
		desktopPointerV: 0,
		desktopPreviewEventsRegisteredBool: false,
		plane: {
			center: {x: 0, y: 1.45, z: -0.8},
			right: {x: 1, y: 0, z: 0},
			up: {x: 0, y: 1, z: 0},
			normal: {x: 0, y: 0, z: 1}
		},
		planeWidth: 0,
		planeHeight: 0,
		cachedSceneLightingState: {
			lightPresetNames: ["Aurora Drift"],
			currentLightPresetIndex: 0,
			currentLightPresetName: "Aurora Drift",
			currentLightPresetDescription: "Slow colorful overhead drift",
			currentLightPresetEffectDescription: "Slow colorful overhead drift",
			currentLightPresetEffectName: "Aurora Drift",
			currentLightPresetEffectIndex: 0,
			currentLightPresetEffectCount: 1,
			currentLightPresetVariantKey: "",
			currentLightPresetVariantIndex: 0,
			currentLightPresetVariantCount: 1,
			currentLightPresetVariantLabel: "",
			currentLightPresetSurfaceKey: "",
			effectSemanticModeKey: PASSTHROUGH_EFFECT_SEMANTIC_MODE_CURRENT,
			effectSemanticModeLabel: "Current"
		}
	};
	const menuPlane = {
		center: {x: 0, y: 1.45, z: -0.8},
		right: {x: 1, y: 0, z: 0},
		up: {x: 0, y: 1, z: 0},
		normal: {x: 0, y: 0, z: 1}
	};
	state.plane = menuPlane;
	const getActiveMenuSliderControlKey = function(hand) {
		return state.activeMenuSliderControlKeyByHand[hand] || "";
	};
	const setActiveMenuSliderControlKey = function(hand, controlKey) {
		if (!hand) {
			return;
		}
		if (controlKey) {
			state.activeMenuSliderControlKeyByHand[hand] = controlKey;
			return;
		}
		delete state.activeMenuSliderControlKeyByHand[hand];
	};
	const isMenuSliderControlActive = function(controlKey) {
		if (!controlKey) {
			return false;
		}
		const hands = Object.keys(state.activeMenuSliderControlKeyByHand);
		for (let i = 0; i < hands.length; i += 1) {
			if (state.activeMenuSliderControlKeyByHand[hands[i]] === controlKey) {
				return true;
			}
		}
		return false;
	};
	const setHoveredActionKey = function(hoverKey) {
		if (hoverKey) {
			state.hoveredActionKeys[hoverKey] = true;
		}
	};
	const createSliderMapping = function(minValue, maxValue) {
		return {
			toSliderT: function(value) {
				return (clampNumber(value, minValue, maxValue) - minValue) / (maxValue - minValue);
			},
			fromSliderT: function(sliderT) {
				return minValue + clampNumber(sliderT, 0, 1) * (maxValue - minValue);
			}
		};
	};
	const eyeDistanceSlider = createSliderMapping(options.eyeDistanceMin, options.eyeDistanceMax);
	const floorAlphaSlider = createSliderMapping(options.floorAlphaMin, options.floorAlphaMax);
	const getControlSliderT = function(control) {
		if (!control) {
			return 0;
		}
		return (clampNumber(control.value, control.min, control.max) - control.min) / (control.max - control.min);
	};
	const getControlValueFromSliderT = function(control, sliderT) {
		return control.min + clampNumber(sliderT, 0, 1) * (control.max - control.min);
	};
	const readPassthroughUiState = passthroughController && passthroughController.getUiState ? passthroughController.getUiState : null;
	const updateCachedSceneLightingState = function(externalState) {
		externalState = externalState || {};
		if (!externalState.lightPresetNames || !externalState.lightPresetNames.length) {
			return;
		}
		state.cachedSceneLightingState = {
			lightPresetNames: externalState.lightPresetNames,
			currentLightPresetIndex: externalState.currentLightPresetIndex || 0,
			currentLightPresetName: externalState.currentLightPresetName || "",
			currentLightPresetDescription: externalState.currentLightPresetDescription || "",
			currentLightPresetEffectDescription: externalState.currentLightPresetEffectDescription || externalState.currentLightPresetDescription || "",
			currentLightPresetEffectName: externalState.currentLightPresetEffectName || externalState.currentLightPresetName || "",
			currentLightPresetEffectIndex: externalState.currentLightPresetEffectIndex || 0,
			currentLightPresetEffectCount: externalState.currentLightPresetEffectCount || 1,
			currentLightPresetVariantKey: externalState.currentLightPresetVariantKey || "",
			currentLightPresetVariantIndex: externalState.currentLightPresetVariantIndex || 0,
			currentLightPresetVariantCount: externalState.currentLightPresetVariantCount || 1,
			currentLightPresetVariantLabel: externalState.currentLightPresetVariantLabel || "",
			currentLightPresetSurfaceKey: externalState.currentLightPresetSurfaceKey || "",
			effectSemanticModeKey: externalState.effectSemanticModeKey || PASSTHROUGH_EFFECT_SEMANTIC_MODE_CURRENT,
			effectSemanticModeLabel: externalState.effectSemanticModeLabel || "Current"
		};
	};
	const getMenuSliderControlByKey = function(passthroughUiState, controlKey) {
		if (!controlKey) {
			return null;
		}
		const controlGroups = [
			passthroughUiState.backgroundControls || [],
			passthroughUiState.passthroughControls || [],
			passthroughUiState.lightingControls || [],
			passthroughUiState.effectSemanticControls || []
		];
		for (let groupIndex = 0; groupIndex < controlGroups.length; groupIndex += 1) {
			const controls = controlGroups[groupIndex];
			for (let controlIndex = 0; controlIndex < controls.length; controlIndex += 1) {
				if (controls[controlIndex].key === controlKey) {
					return controls[controlIndex];
				}
			}
		}
		return null;
	};
	const getModuleSections = function(externalState) {
		updateCachedSceneLightingState(externalState);
		const passthroughUiState = readPassthroughUiState ? readPassthroughUiState() : DEFAULT_MENU_PASSTHROUGH_UI_STATE;
		const lightingState = state.cachedSceneLightingState;
		const lightPresetNames = lightingState.lightPresetNames || ["Aurora Drift"];
		const lightPresetIndex = clampNumber(lightingState.currentLightPresetIndex || 0, 0, Math.max(0, lightPresetNames.length - 1));
		externalState = externalState || {};
		const shaderModeNames = externalState.shaderModeNames && externalState.shaderModeNames.length ? externalState.shaderModeNames : ["No mode"];
		const currentShaderModeIndex = clampNumber(externalState.currentShaderModeIndex || 0, 0, shaderModeNames.length - 1);
		const presetNames = externalState.presetNames && externalState.presetNames.length ? externalState.presetNames : ["No preset"];
		const currentPresetIndex = clampNumber(externalState.currentPresetIndex || 0, 0, presetNames.length - 1);
		const xrSessionActiveBool = externalState.xrSessionActiveBool == null ? state.xrSessionActiveBool : !!externalState.xrSessionActiveBool;
		const createMenuSliderState = function(control) {
			return {
				control,
				sliderT: getControlSliderT(control),
				hoveredBool: !!state.hoveredActionKeys[control.key],
				activeBool: isMenuSliderControlActive(control.key)
			};
		};
		return buildModuleSections({
			selectedJumpMode: state.jumpMode,
			hoveredActionKeys: state.hoveredActionKeys,
			floorAlpha: state.floorAlpha,
			floorAlphaSliderT: floorAlphaSlider.toSliderT(state.floorAlpha),
			floorAlphaHoverBool: !!state.hoveredActionKeys.floorAlpha,
			floorAlphaActiveBool: !!state.activeFloorAlphaSliderHand,
			passthroughUiState,
			backgroundControls: (passthroughUiState.backgroundControls || []).map(createMenuSliderState),
			passthroughControls: (passthroughUiState.passthroughControls || []).map(createMenuSliderState),
			eyeDistanceMeters: state.eyeDistanceMeters,
			eyeDistanceMin: options.eyeDistanceMin,
			eyeDistanceMax: options.eyeDistanceMax,
			eyeDistanceSliderT: eyeDistanceSlider.toSliderT(state.eyeDistanceMeters),
			eyeDistanceHoverBool: !!state.hoveredActionKeys.eyeDistance,
			eyeDistanceActiveBool: !!state.activeSliderHand,
			currentShaderModeName: shaderModeNames[currentShaderModeIndex],
			shaderModeMetaText: (currentShaderModeIndex + 1) + " / " + shaderModeNames.length,
			horizontalMirrorBool: !!externalState.horizontalMirrorBool,
			lightingModes: passthroughUiState.lightingModes || [],
			lightingAnchorModes: passthroughUiState.lightingAnchorModes || passthroughLightingAnchorModeDefinitions,
			selectedLightingModeKey: passthroughUiState.selectedLightingModeKey,
			selectedLightingAnchorModeKey: passthroughUiState.selectedLightingAnchorModeKey || "auto",
			lightPresetNames,
			currentLightPresetIndex: lightPresetIndex,
			currentLightPresetName: lightingState.currentLightPresetName || lightPresetNames[lightPresetIndex] || "Aurora Drift",
			currentLightPresetDescription: lightingState.currentLightPresetDescription || "",
			currentLightPresetEffectDescription: lightingState.currentLightPresetEffectDescription || lightingState.currentLightPresetDescription || "",
			currentLightPresetEffectName: lightingState.currentLightPresetEffectName || lightingState.currentLightPresetName || lightPresetNames[lightPresetIndex] || "Aurora Drift",
			currentLightPresetEffectIndex: lightingState.currentLightPresetEffectIndex || 0,
			currentLightPresetEffectCount: lightingState.currentLightPresetEffectCount || 1,
			currentLightPresetVariantKey: lightingState.currentLightPresetVariantKey || "",
			currentLightPresetVariantIndex: lightingState.currentLightPresetVariantIndex || 0,
			currentLightPresetVariantCount: lightingState.currentLightPresetVariantCount || 1,
			currentLightPresetVariantLabel: lightingState.currentLightPresetVariantLabel || "",
			currentLightPresetSurfaceKey: lightingState.currentLightPresetSurfaceKey || "",
			effectSemanticModeKey: lightingState.effectSemanticModeKey || PASSTHROUGH_EFFECT_SEMANTIC_MODE_CURRENT,
			effectSemanticModeLabel: lightingState.effectSemanticModeLabel || "Current",
			sceneLightingControls: (passthroughUiState.lightingControls || []).map(createMenuSliderState),
			effectSemanticControls: (passthroughUiState.effectSemanticControls || []).map(createMenuSliderState),
			currentPresetName: presetNames[currentPresetIndex],
			presetMetaText: (currentPresetIndex + 1) + " / " + presetNames.length,
			audioSourceKind: externalState.audioSourceKind || "none",
			audioSourceName: externalState.audioSourceName || "",
			xrSessionActiveBool
		});
	};
	const clearHoverState = function() {
		state.hoveredActionKeys = {};
	};
	const releaseSliderHand = function(hand) {
		if (state.activeSliderHand === hand) {
			state.activeSliderHand = "";
		}
		if (state.activeFloorAlphaSliderHand === hand) {
			state.activeFloorAlphaSliderHand = "";
		}
		setActiveMenuSliderControlKey(hand, "");
	};
	const getCapturedModuleSliderKey = function(hand) {
		if (state.activeSliderHand === hand) {
			return "eyeDistance";
		}
		if (state.activeFloorAlphaSliderHand === hand) {
			return "floorAlpha";
		}
		return getActiveMenuSliderControlKey(hand);
	};
	const getMenuViewSliderT = function(moduleSections, controlKey, u, v) {
		if (!controlKey || !menuView.getSliderTAtUv) {
			return clampNumber(u, 0, 1);
		}
		return menuView.getSliderTAtUv(u, v, moduleSections, controlKey);
	};
	// Keep raw hover data intact and only promote the captured slider during an active drag.
	const applySliderCaptureState = function(hit, hand, moduleSections) {
		if (!hit) {
			return hit;
		}
		const capturedModuleSliderControlKey = getCapturedModuleSliderKey(hand);
		hit.capturedModuleSliderControlKey = capturedModuleSliderControlKey;
		if (capturedModuleSliderControlKey) {
			hit.moduleSliderControlKey = capturedModuleSliderControlKey;
			hit.action = null;
			hit.hoverKey = capturedModuleSliderControlKey;
			hit.sliderT = getMenuViewSliderT(moduleSections, capturedModuleSliderControlKey, hit.u, hit.v);
		}
		return hit;
	};
	const applyPassthroughState = function(args) {
		if (passthroughController && passthroughController.setSessionState) {
			passthroughController.setSessionState(args);
		}
		syncDerivedState();
	};
	const buildMenuRenderState = function(externalState) {
		externalState = externalState || {};
		const moduleSections = getModuleSections(externalState);
		return {
			sceneTimeSeconds: externalState.sceneTimeSeconds,
			audioMetrics: externalState.audioMetrics,
			jumpMode: state.jumpMode,
			hoveredActionKeys: state.hoveredActionKeys,
			floorAlpha: state.floorAlpha,
			eyeDistanceMeters: state.eyeDistanceMeters,
			floorAlphaHoverBool: !!state.hoveredActionKeys["floorAlpha"],
			eyeDistanceHoverBool: !!state.hoveredActionKeys["eyeDistance"],
			floorAlphaSliderActiveBool: !!state.activeFloorAlphaSliderHand,
			eyeDistanceSliderActiveBool: !!state.activeSliderHand,
			moduleSections: moduleSections,
			shaderModeNames: externalState.shaderModeNames,
			currentShaderModeIndex: externalState.currentShaderModeIndex,
			presetNames: externalState.presetNames,
			currentPresetIndex: externalState.currentPresetIndex,
			eyeDistanceMin: options.eyeDistanceMin,
			eyeDistanceMax: options.eyeDistanceMax,
			eyeDistanceSliderT: eyeDistanceSlider.toSliderT(state.eyeDistanceMeters),
			floorAlphaSliderT: floorAlphaSlider.toSliderT(state.floorAlpha)
		};
	};
	const syncDerivedState = function() {
		const moduleSections = getModuleSections();
		let rightRayHitsMenuBool = false;
		for (let i = 0; i < controllerRays.length; i += 1) {
			if (controllerRays[i].hand === "right" && controllerRays[i].hitBool) {
				rightRayHitsMenuBool = true;
				break;
			}
		}
		state.menuConsumesRightTriggerBool = state.menuOpenBool && (rightRayHitsMenuBool || state.activeSliderHand === "right" || state.activeFloorAlphaSliderHand === "right" || !!getActiveMenuSliderControlKey("right"));
		const planeDimensions = menuView.getPlaneDimensions(moduleSections);
		state.planeWidth = planeDimensions.width;
		state.planeHeight = planeDimensions.height;
	};
	const resetMenuInteractionState = function() {
		state.menuOpenBool = false;
		state.menuTogglePressedBool = false;
		state.activeSliderHand = "";
		state.activeFloorAlphaSliderHand = "";
		state.activeMenuSliderControlKeyByHand = {};
		clearHoverState();
		controllerRays.length = 0;
		triggerPressedByHand.clear();
		syncDerivedState();
	};
	const setActiveSliderHoverKeys = function(hand) {
		if (state.activeSliderHand === hand) { setHoveredActionKey("eyeDistance"); }
		if (state.activeFloorAlphaSliderHand === hand) { setHoveredActionKey("floorAlpha"); }
		const activeKey = getActiveMenuSliderControlKey(hand);
		if (activeKey) { setHoveredActionKey(activeKey); }
	};
	const applyEyeDistanceSliderHit = function(hand, sliderT) {
		state.activeSliderHand = hand;
		setActiveMenuSliderControlKey(hand, "");
		if (state.activeFloorAlphaSliderHand === hand) {
			state.activeFloorAlphaSliderHand = "";
		}
		state.eyeDistanceMeters = eyeDistanceSlider.fromSliderT(sliderT);
		syncDerivedState();
	};
	const applyFloorAlphaSliderHit = function(hand, sliderT) {
		state.activeFloorAlphaSliderHand = hand;
		setActiveMenuSliderControlKey(hand, "");
		if (state.activeSliderHand === hand) {
			state.activeSliderHand = "";
		}
		state.floorAlpha = floorAlphaSlider.fromSliderT(sliderT);
		syncDerivedState();
	};
	const applyMenuSliderControlHit = function(hand, sliderT, menuSliderControl) {
		if (!menuSliderControl || !passthroughController || !passthroughController.setControlValue) {
			return;
		}
		setActiveMenuSliderControlKey(hand, menuSliderControl.key);
		if (state.activeSliderHand === hand) {
			state.activeSliderHand = "";
		}
		if (state.activeFloorAlphaSliderHand === hand) {
			state.activeFloorAlphaSliderHand = "";
		}
		passthroughController.setControlValue(menuSliderControl.key, getControlValueFromSliderT(menuSliderControl, sliderT));
		syncDerivedState();
	};
	const applyDesktopHoverState = function(pointerLockedBool, xrSessionActiveBool) {
		const passthroughUiState = readPassthroughUiState ? readPassthroughUiState() : DEFAULT_MENU_PASSTHROUGH_UI_STATE;
		const moduleSections = getModuleSections({xrSessionActiveBool: xrSessionActiveBool});
		if (xrSessionActiveBool || !state.desktopPreviewVisibleBool || pointerLockedBool || !state.desktopPointerActiveBool) {
			state.hoveredActionKeys = {};
			setActiveSliderHoverKeys("desktop");
			syncDerivedState();
			return;
		}
		const hit = menuView.getInteractionAtUv(state.desktopPointerU, state.desktopPointerV, moduleSections);
		state.hoveredActionKeys = {};
		setHoveredActionKey(hit.hoverKey);
		setActiveSliderHoverKeys("desktop");
		if (state.activeSliderHand === "desktop") {
			state.eyeDistanceMeters = eyeDistanceSlider.fromSliderT(getMenuViewSliderT(moduleSections, "eyeDistance", state.desktopPointerU, state.desktopPointerV));
		}
		if (state.activeFloorAlphaSliderHand === "desktop") {
			state.floorAlpha = floorAlphaSlider.fromSliderT(getMenuViewSliderT(moduleSections, "floorAlpha", state.desktopPointerU, state.desktopPointerV));
		}
		const activeMenuSliderControl = getMenuSliderControlByKey(passthroughUiState, getActiveMenuSliderControlKey("desktop"));
		if (activeMenuSliderControl && passthroughController && passthroughController.setControlValue) {
			passthroughController.setControlValue(activeMenuSliderControl.key, getControlValueFromSliderT(activeMenuSliderControl, getMenuViewSliderT(moduleSections, activeMenuSliderControl.key, state.desktopPointerU, state.desktopPointerV)));
		}
		syncDerivedState();
	};
	const intersectMenu = function(ray) {
		if (!state.menuOpenBool) {
			return null;
		}
		const moduleSections = getModuleSections();
		const planeDimensions = menuView.getPlaneDimensions(moduleSections);
		const denom = dotVec3(menuPlane.normal.x, menuPlane.normal.y, menuPlane.normal.z, ray.dir.x, ray.dir.y, ray.dir.z);
		if (Math.abs(denom) < 0.0001) {
			return null;
		}
		const distance = dotVec3(menuPlane.center.x - ray.origin.x, menuPlane.center.y - ray.origin.y, menuPlane.center.z - ray.origin.z, menuPlane.normal.x, menuPlane.normal.y, menuPlane.normal.z) / denom;
		if (distance <= 0 || distance > options.rayLength) {
			return null;
		}
		const point = {x: ray.origin.x + ray.dir.x * distance, y: ray.origin.y + ray.dir.y * distance, z: ray.origin.z + ray.dir.z * distance};
		const relX = point.x - menuPlane.center.x;
		const relY = point.y - menuPlane.center.y;
		const relZ = point.z - menuPlane.center.z;
		const localX = dotVec3(relX, relY, relZ, menuPlane.right.x, menuPlane.right.y, menuPlane.right.z);
		const localY = dotVec3(relX, relY, relZ, menuPlane.up.x, menuPlane.up.y, menuPlane.up.z);
		const u = 0.5 + localX / planeDimensions.width;
		const v = 0.5 - localY / planeDimensions.height;
		if (Math.abs(localX) > planeDimensions.width * 0.5 || Math.abs(localY) > planeDimensions.height * 0.5) {
			if (state.activeSliderHand !== ray.hand && state.activeFloorAlphaSliderHand !== ray.hand && !getActiveMenuSliderControlKey(ray.hand)) {
				return null;
			}
			const clampedU = clampNumber(u, 0, 1);
			const clampedV = clampNumber(v, 0, 1);
			const capturedModuleSliderControlKey = getCapturedModuleSliderKey(ray.hand);
			return {
				distance: distance,
				point: point,
				u: clampedU,
				v: clampedV,
				sliderT: getMenuViewSliderT(moduleSections, capturedModuleSliderControlKey, clampedU, clampedV),
				capturedModuleSliderControlKey: capturedModuleSliderControlKey,
				action: null,
				hoverKey: capturedModuleSliderControlKey,
				moduleSliderControlKey: capturedModuleSliderControlKey
			};
		}
		return applySliderCaptureState(Object.assign({distance: distance, point: point, u: u, v: v}, menuView.getInteractionAtUv(u, v, moduleSections)), ray.hand, moduleSections);
	};
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
				setHoveredActionKey(hit.hoverKey);
			}
			controllerRays.push(ray);
		}
		syncDerivedState();
	};
	const updateMenuPose = function(pose) {
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
		syncDerivedState();
	};
	const isXrMenuTogglePressed = function(source) {
		const gamepad = source && source.gamepad;
		if (!gamepad || !gamepad.buttons) {
			return false;
		}
		const secondaryFaceButton = gamepad.buttons[5] || (gamepad.buttons.length <= 5 ? gamepad.buttons[4] : null);
		return !!(secondaryFaceButton && secondaryFaceButton.pressed);
	};
	const applyXrMenuToggleState = function(args) {
		const sources = args.xrSession ? args.xrSession.inputSources || [] : [];
		let togglePressedBool = false;
		for (let i = 0; i < sources.length; i += 1) {
			if (isXrMenuTogglePressed(sources[i])) {
				togglePressedBool = true;
				break;
			}
		}
		if (togglePressedBool && !state.menuTogglePressedBool) {
			state.menuOpenBool = !state.menuOpenBool;
			state.activeSliderHand = "";
			state.activeFloorAlphaSliderHand = "";
			state.activeMenuSliderControlKeyByHand = {};
			clearHoverState();
			if (state.menuOpenBool) {
				updateMenuPose(args.pose);
			} else {
				controllerRays.length = 0;
				triggerPressedByHand.clear();
			}
		}
		state.menuTogglePressedBool = togglePressedBool;
		syncDerivedState();
	};
	const applyXrRayTriggerState = function(ray, dispatchMenuAction) {
		const gamepad = ray.source.gamepad;
		const hand = ray.hand;
		const triggerPressedBool = !!(gamepad && gamepad.buttons[0] && gamepad.buttons[0].pressed);
		const wasTriggerPressedBool = triggerPressedByHand.get(hand) || false;
		const passthroughUiState = readPassthroughUiState ? readPassthroughUiState() : DEFAULT_MENU_PASSTHROUGH_UI_STATE;
		if (triggerPressedBool && !wasTriggerPressedBool && ray.hit && ray.hit.action && dispatchMenuAction) {
			dispatchMenuAction(ray.hit.action);
		}
		if (triggerPressedBool && ray.hit && ray.hit.moduleSliderControlKey === "eyeDistance" && (!wasTriggerPressedBool || state.activeSliderHand === hand)) {
			applyEyeDistanceSliderHit(hand, ray.hit.sliderT);
		}
		if (triggerPressedBool && ray.hit && ray.hit.moduleSliderControlKey === "floorAlpha" && (!wasTriggerPressedBool || state.activeFloorAlphaSliderHand === hand)) {
			applyFloorAlphaSliderHit(hand, ray.hit.sliderT);
		}
		const menuSliderControl = getMenuSliderControlByKey(passthroughUiState, ray.hit && ray.hit.moduleSliderControlKey);
		if (triggerPressedBool && ray.hit && (!wasTriggerPressedBool || getActiveMenuSliderControlKey(hand) === (menuSliderControl && menuSliderControl.key))) {
			applyMenuSliderControlHit(hand, ray.hit.sliderT, menuSliderControl);
		}
		if (!triggerPressedBool && wasTriggerPressedBool) {
			releaseSliderHand(hand);
		}
		triggerPressedByHand.set(hand, triggerPressedBool);
		syncDerivedState();
	};
	const syncMissingXrHands = function() {
		const handsWithRays = new Set();
		for (let i = 0; i < controllerRays.length; i += 1) {
			handsWithRays.add(controllerRays[i].hand);
		}
		for (const hand of triggerPressedByHand.keys()) {
			if (!handsWithRays.has(hand)) {
				releaseSliderHand(hand);
				triggerPressedByHand.set(hand, false);
			}
		}
		syncDerivedState();
	};
	const updateDesktopPointerFromEvent = function(event) {
		const rect = previewCanvas.getBoundingClientRect();
		if (rect.width <= 0 || rect.height <= 0) {
			return null;
		}
		state.desktopPointerU = clampNumber((event.clientX - rect.left) / rect.width, 0, 1);
		state.desktopPointerV = clampNumber((event.clientY - rect.top) / rect.height, 0, 1);
		state.desktopPointerActiveBool = true;
		return menuView.getInteractionAtUv(state.desktopPointerU, state.desktopPointerV, getModuleSections({xrSessionActiveBool: state.xrSessionActiveBool}));
	};
	const clearDesktopPointerState = function() {
		state.desktopPointerActiveBool = false;
		state.desktopPointerU = 0;
		state.desktopPointerV = 0;
		clearHoverState();
		releaseSliderHand("desktop");
		syncDerivedState();
	};
	const handleDesktopPointerUp = function() {
		releaseSliderHand("desktop");
	};
	const handleDesktopPointerMove = function(event, args) {
		args = args || {};
		if (args.xrSessionActiveBool || args.pointerLockedBool || !state.desktopPreviewVisibleBool) {
			return null;
		}
		return updateDesktopPointerFromEvent(event);
	};
	const handleDesktopPointerLeave = function() {
		if (state.activeSliderHand === "desktop" || state.activeFloorAlphaSliderHand === "desktop" || !!getActiveMenuSliderControlKey("desktop")) {
			return;
		}
		clearDesktopPointerState();
	};
	const handleDesktopPointerDown = function(event, dispatchMenuAction, args) {
		args = args || {};
		if (args.xrSessionActiveBool || args.pointerLockedBool || !state.desktopPreviewVisibleBool) {
			return false;
		}
		const hit = updateDesktopPointerFromEvent(event);
		if (!hit) {
			return false;
		}
		const passthroughUiState = readPassthroughUiState ? readPassthroughUiState() : DEFAULT_MENU_PASSTHROUGH_UI_STATE;
		if (hit.action && dispatchMenuAction) {
			dispatchMenuAction(hit.action);
		}
		if (hit.moduleSliderControlKey === "eyeDistance") {
			applyEyeDistanceSliderHit("desktop", hit.sliderT);
		}
		if (hit.moduleSliderControlKey === "floorAlpha") {
			applyFloorAlphaSliderHit("desktop", hit.sliderT);
		}
		const menuSliderControl = getMenuSliderControlByKey(passthroughUiState, hit.moduleSliderControlKey);
		applyMenuSliderControlHit("desktop", hit.sliderT, menuSliderControl);
		return true;
	};
	const resetSessionState = function() {
		state.xrSessionActiveBool = false;
		resetMenuInteractionState();
	};
	const registerDesktopPreviewEvents = function(args) {
		args = args || {};
		if (state.desktopPreviewEventsRegisteredBool) {
			return;
		}
		const dispatchMenuAction = args.dispatchMenuAction || null;
		const runtimeState = args.runtimeState || {};
		const desktopInputState = args.desktopInputState || {};
		menuEventRegistry.on(previewCanvas, "mousemove", function(event) {
			handleDesktopPointerMove(event, {
				xrSessionActiveBool: !!runtimeState.xrSession,
				pointerLockedBool: !!desktopInputState.pointerLockedBool
			});
		});
		menuEventRegistry.on(previewCanvas, "mouseleave", function() {
			handleDesktopPointerLeave();
		});
		menuEventRegistry.on(previewCanvas, "mousedown", function(event) {
			if (handleDesktopPointerDown(event, dispatchMenuAction, {
				xrSessionActiveBool: !!runtimeState.xrSession,
				pointerLockedBool: !!desktopInputState.pointerLockedBool
			})) {
				event.preventDefault();
			}
		});
		menuEventRegistry.on(previewCanvas, "mouseup", function() {
			handleDesktopPointerUp();
		});
		menuEventRegistry.on(windowRef, "mousemove", function(event) {
			if (getCapturedModuleSliderKey("desktop")) {
				handleDesktopPointerMove(event, {
					xrSessionActiveBool: !!runtimeState.xrSession,
					pointerLockedBool: !!desktopInputState.pointerLockedBool
				});
			}
		});
		menuEventRegistry.on(windowRef, "mouseup", function() {
			handleDesktopPointerUp();
		});
		state.desktopPreviewEventsRegisteredBool = true;
	};
	const updateXrInput = function(args) {
		args = args || {};
		state.xrSessionActiveBool = !!args.xrSession;
		applyXrMenuToggleState(args);
		updateControllerRays(args.frame, args.xrSession, args.xrRefSpace);
		syncMissingXrHands();
		for (let i = 0; i < controllerRays.length; i += 1) {
			applyXrRayTriggerState(controllerRays[i], args.dispatchMenuAction || null);
		}
	};
	const renderTexture = function(gl, menuTexture, externalState) {
		menuView.render(buildMenuRenderState(externalState));
		gl.bindTexture(gl.TEXTURE_2D, menuTexture);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, menuCanvas);
	};
	const updateDesktopPreview = function(args) {
		args = args || {};
		state.xrSessionActiveBool = !!args.xrSessionActiveBool;
		applyDesktopHoverState(args.pointerLockedBool, args.xrSessionActiveBool);
		menuView.updateDesktopPreview({
			visibleBool: state.desktopPreviewVisibleBool,
			interactiveBool: !!args.interactiveBool,
			renderState: buildMenuRenderState(args.renderState)
		});
	};
	const setDesktopPreviewVisibleBool = function(visibleBool) {
		state.desktopPreviewVisibleBool = !!visibleBool;
		if (!state.desktopPreviewVisibleBool) {
			clearDesktopPointerState();
			applyStyles(previewCanvas, {display: "none"});
			return;
		}
		applyStyles(previewCanvas, {display: "block"});
		syncDerivedState();
	};
	const destroy = function() {
		menuEventRegistry.removeAll();
		controllerRays.length = 0;
		triggerPressedByHand.clear();
	};
	const setPassthroughState = function(args) {
		applyPassthroughState(args);
	};
	const setJumpMode = function(jumpMode) {
		if (jumpMode === "double" || jumpMode === "multi") {
			state.jumpMode = jumpMode;
			syncDerivedState();
		}
	};
	syncDerivedState();
	return {
		state,
		controllerRays,
		renderTexture,
		updateDesktopPreview,
		registerDesktopPreviewEvents: registerDesktopPreviewEvents,
		handleDesktopPointerUp: handleDesktopPointerUp,
		clearDesktopPointerState: clearDesktopPointerState,
		setDesktopPreviewVisibleBool,
		updateXrInput: updateXrInput,
		resetSessionState: resetSessionState,
		endSession: resetSessionState,
		destroy,
		setPassthroughState,
		setJumpMode
	};
};
