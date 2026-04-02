// This module owns generic menu section/control state builders.
const getMenuModeLabelByKey = function(definitions, key, fallbackLabel) {
	const index = findModeIndexByKey(definitions || [], key);
	return index >= 0 && definitions[index] ? definitions[index].label : (fallbackLabel || "");
};

const formatMenuPercentText = function(value) {
	return Math.round(value * 100) + "%";
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
		sliderU: args.sliderU || 0,
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
			sliderU: sliderControl.sliderU || 0,
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
		title: "World Opacity",
		badgeText: formatMenuPercentText(args.value || 0),
		controls: [
			createSliderMenuControlState({
				key: "floorAlpha",
				label: "",
				valueText: "",
				sliderU: args.sliderU || 0,
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
		title: "Eye Distance",
		badgeText: Math.round((args.value || 0) * 1000) + " mm",
		controls: [
			createSliderMenuControlState({
				key: "eyeDistance",
				label: "",
				valueText: "",
				sliderU: args.sliderU || 0,
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
			sliderU: sliderControl.sliderU || 0,
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
					checkedBool: !!uiState.depthRadialBool,
					hoveredBool: hasHoveredActionKey(args, "passthroughDepthRadialToggle:toggle"),
					action: {type: "passthroughDepthRadial.toggle"},
					hoverKey: "passthroughDepthRadialToggle:toggle"
				},
				{
					key: "passthroughDepthMotionCompensationToggle",
					label: "Motion compensation",
					checkedBool: !!uiState.depthMotionCompensationBool,
					hoveredBool: hasHoveredActionKey(args, "passthroughDepthMotionCompensationToggle:toggle"),
					action: {type: "passthroughDepthMotionCompensation.toggle"},
					hoverKey: "passthroughDepthMotionCompensationToggle:toggle"
				}
			]
		}));
		appendDepthSliderControlByKey("depthMotionCompensationFactor");
		controls.push(createCyclerMenuControlState({
			key: "passthroughDepthReconstruction",
			label: "Reconstruction",
			valueText: getMenuModeLabelByKey(uiState.depthReconstructionModes, uiState.selectedDepthReconstructionModeKey, "Heightmap"),
			hoveredAction: getHoveredCyclerAction(args, "passthroughDepthReconstruction:prev", "passthroughDepthReconstruction:next"),
			prevAction: {type: "passthroughDepthReconstruction.cycle", direction: -1},
			nextAction: {type: "passthroughDepthReconstruction.cycle", direction: 1},
			prevHoverKey: "passthroughDepthReconstruction:prev",
			nextHoverKey: "passthroughDepthReconstruction:next"
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
		})
	];
	appendSliderMenuControls(controls, args.sliderControls);
	return createMenuSectionState({
		key: "sceneLighting",
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
			hoveredActionKeys: args.hoveredActionKeys
		}),
		createEyeDistanceMenuSectionState({
			value: args.eyeDistanceMeters,
			min: args.eyeDistanceMin,
			max: args.eyeDistanceMax,
			sliderU: args.eyeDistanceSliderU,
			hoveredBool: args.eyeDistanceHoverBool,
			activeBool: args.eyeDistanceActiveBool
		}),
		createWorldOpacityMenuSectionState({
			value: args.floorAlpha,
			sliderU: args.floorAlphaSliderU,
			hoveredBool: args.floorAlphaHoverBool,
			activeBool: args.floorAlphaActiveBool
		}),
		createBackgroundMenuSectionState({
			uiState: args.passthroughUiState,
			hoveredActionKeys: args.hoveredActionKeys,
			sliderControls: args.backgroundControls
		}),
		createPassthroughMenuSectionState({
			uiState: args.passthroughUiState,
			hoveredActionKeys: args.hoveredActionKeys,
			sliderControls: args.passthroughControls
		}),
		createSceneLightingMenuSectionState({
			lightingModes: args.lightingModes,
			selectedLightingModeKey: args.selectedLightingModeKey,
			hoveredActionKeys: args.hoveredActionKeys,
			currentLightPresetName: args.currentLightPresetName,
			currentLightPresetDescription: args.currentLightPresetDescription,
			sliderControls: args.sceneLightingControls
		}),
		createVisualizerModeMenuSectionState({
			valueText: args.currentShaderModeName,
			metaText: args.shaderModeMetaText,
			hoveredActionKeys: args.hoveredActionKeys,
			horizontalMirrorBool: args.horizontalMirrorBool,
			checkboxValueText: args.horizontalMirrorBool ? "On" : "Off"
		}),
		createButterchurnPresetMenuSectionState({
			valueText: args.currentPresetName,
			metaText: args.presetMetaText,
			hoveredActionKeys: args.hoveredActionKeys
		}),
		createSessionMenuSectionState({
			xrSessionActiveBool: !!args.xrSessionActiveBool,
			hoveredActionKeys: args.hoveredActionKeys
		})
	].filter(Boolean);
};
