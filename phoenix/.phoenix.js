'use strict';

// TODO WorkSpace, 绑定快捷键，快速调出已经保存好布局的应用，支持多个Workspace间切换，将未在Workspace的应用隐藏起来
// TODO Layout，支持快速布局，9格的方式
// TODO Ignore apps

var keys = [];

var hotKey = ["alt"];
var hotKeyShift = ["alt", "shift"];
var hotKeyCtrl = ["alt", "ctrl"];
var hotKeyCmd = ["alt", "cmd"];
var _mousePositions = {};

// 自定义配置
Phoenix.set({
    'daemon': false,
    'openAtLogin': true
});

// 通用函数
// {{{
if (!String.format) {
    String.format = function(format) {
        var args = Array.prototype.slice.call(arguments, 1);
        return format.replace(/{(\d+)}/g, function(match, number) {
            return typeof args[number] != 'undefined' ? args[number] : match;
        });
    };
}

function message(msg) {
    var modal = new Modal();
    var frame = Screen.mainScreen().frameInRectangle();
    var sX = frame.x;
    var sW = frame.width;

    modal.origin = {
        x: sX + Math.round((sW / 2) - (modal.frame().width / 2)),
        y: 20
    };

    modal.message = msg;
    modal.duration = 1;

    modal.show();
}

function notify(msg) {
    Phoenix.notify(msg);
}

function log(msg) {
    Phoenix.log(msg);
}

function on(event, callback) {
    Phoenix.on(event, callback)
}

function after(msg) {
    Phoenix.after(event, callback)
}

function every(event, callback) {
    Phoenix.every(event, callback)
}

function assert(condition, message) {
    if (!condition) {
        throw message || "Assertion failed";
    }
}

function sortByMostRecent(windows) {
    var visibleAppMostRecentFirst = _.map(Window.visibleWindowsInOrder(), function(w) {
        return w.hash();
    });
    var visibleAppMostRecentFirstWithWeight = _.object(visibleAppMostRecentFirst, _.range(visibleAppMostRecentFirst.length));
    return _.sortBy(windows, function(window) {
        return visibleAppMostRecentFirstWithWeight[window.hash()];
    });
}

// }}}

// 鼠标指针
// {{{
function save_mouse_position_for_window(window) {
    if (!window) return;
    var pos = Mouse.location()
        //pos.y = 800 - pos.y;  // fix phoenix 2.x bug
    _mousePositions[window.hash()] = pos;
}

function set_mouse_position_for_window_center(window) {
    Mouse.moveTo({
        x: window.topLeft().x + window.frame().width / 2,
        y: window.topLeft().y + window.frame().height / 2
    });
}

function restore_mouse_position_for_window(window) {
    if (!_mousePositions[window.hash()]) {
        set_mouse_position_for_window_center(window);
        return;
    }
    var pos = _mousePositions[window.hash()];
    var rect = window.frame();
    if (pos.x < rect.x || pos.x > (rect.x + rect.width) || pos.y < rect.y || pos.y > (rect.y + rect.height)) {
        set_mouse_position_for_window_center(window);
        return;
    }
    //Phoenix.log(String.format('x: {0}, y: {1}', pos.x, pos.y));
    Mouse.moveTo(pos);
}

function restore_mouse_position_for_now() {
    if (Window.focusedWindow() === undefined) {
        return;
    }
    restore_mouse_position_for_window(Window.focusedWindow());
}
// }}}

// 运行应用
// {{{
function focusApplicationIfRunning(title) {
    // 启动App
    var app = App.launch(title);
    assert(app !== undefined);
    if (app.isActive()) {
        app.hide();
        return app;
    }
    app.activate();
    app.focus();
    message(app.name());
    return app;
}

function switchToLastUsedWindow(title) {
    var last_used_window = _.find(Window.visibleWindowsMostRecentFirst().reverse(), function(window) {
        if (window.app().title() == title) return true;
    });

    last_used_window.focusWindow();
}

keys.push(Phoenix.bind('1', hotKey, function() {
    focusApplicationIfRunning('iTerm');
}));
keys.push(Phoenix.bind('2', hotKey, function() {
    focusApplicationIfRunning('MacVim');
}));
keys.push(Phoenix.bind('3', hotKey, function() {
    focusApplicationIfRunning('Dash');
}));
keys.push(Phoenix.bind('4', hotKey, function() {
    focusApplicationIfRunning('Atom');
}));

keys.push(Phoenix.bind('q', hotKey, function() {
    focusApplicationIfRunning('Google Chrome');
}));
keys.push(Phoenix.bind('w', hotKey, function() {
    focusApplicationIfRunning('有道词典');
}));
keys.push(Phoenix.bind('e', hotKey, function() {
    focusApplicationIfRunning('NeteaseMusic');
}));
keys.push(Phoenix.bind('r', hotKey, function() {
    focusApplicationIfRunning('Mail');
}));

keys.push(Phoenix.bind('a', hotKey, function() {
    focusApplicationIfRunning('钉钉');
}));
keys.push(Phoenix.bind('s', hotKey, function() {
    focusApplicationIfRunning('Wechat');
}));
keys.push(Phoenix.bind('d', hotKey, function() {
    focusApplicationIfRunning('QQ');
}));
keys.push(Phoenix.bind('f', hotKey, function() {
    focusApplicationIfRunning('Evernote');
}));
// }}}

// 切换屏幕
// {{{
// 移动窗口屏幕
function moveToScreen(window, screen) {
    if (!window) {
        return;
    }
    if (!screen) {
        return;
    }

    var frame = window.frame();
    var oldScreenRect = window.screen().visibleFrameInRectangle();
    var newScreenRect = screen.visibleFrameInRectangle();
    var xRatio = newScreenRect.width / oldScreenRect.width;
    var yRatio = newScreenRect.height / oldScreenRect.height;

    var mid_pos_x = frame.x + Math.round(0.5 * frame.width);
    var mid_pos_y = frame.y + Math.round(0.5 * frame.height);

    window.setFrame({
        x: (mid_pos_x - oldScreenRect.x) * xRatio + newScreenRect.x - 0.5 * frame.width,
        y: (mid_pos_y - oldScreenRect.y) * yRatio + newScreenRect.y - 0.5 * frame.height,
        width: frame.width,
        height: frame.height
    });
}

// 焦点切换到另外一个屏幕
function focusAnotherScreen(window, targetScreen) {
    if (!window) return;
    var currentScreen = window.screen();
    if (window.screen() === targetScreen) return;
    save_mouse_position_for_window(window);
    var targetScreenWindows = sortByMostRecent(targetScreen.windows());
    if (targetScreenWindows.length == 0) {
        return;
    }
    var targetWindow = targetScreenWindows[0]
    targetWindow.focus(); // FIXME two window in two space, focus will focus in same space first
    restore_mouse_position_for_window(targetWindow);
}

// 快捷键
// 移动焦点到下一个屏幕
keys.push(Phoenix.bind('l', hotKey, function() {
    var window = Window.focusedWindow();
    var allScreens = Screen.screens();
    var currentScreen = window.screen();
    var targetScreen = window.screen().next();
    if (_.indexOf(_.map(allScreens, function(x) {
            return x.hash();
        }), targetScreen.hash()) >= _.indexOf(_.map(allScreens, function(x) {
            return x.hash();
        }), currentScreen.hash())) {
        return;
    }
    focusAnotherScreen(window, targetScreen);
}));

// 移动焦点到上一个屏幕
keys.push(Phoenix.bind('h', hotKey, function() {
    var window = Window.focusedWindow();
    var allScreens = Screen.screens();
    var currentScreen = window.screen();
    var targetScreen = window.screen().previous();
    if (_.indexOf(_.map(allScreens, function(x) {
            return x.hash();
        }), targetScreen.hash()) <= _.indexOf(_.map(allScreens, function(x) {
            return x.hash();
        }), currentScreen.hash())) {
        return;
    }
    focusAnotherScreen(window, targetScreen);
}));

// 移动窗口到上一个屏幕
keys.push(Phoenix.bind('l', hotKeyShift, function() {
    var window = Window.focusedWindow();
    if (!window) {
        return;
    }
    if (window.screen() === window.screen().next()) {
        return;
    }
    if (window.screen().next().frameInRectangle().x < 0) {
        return;
    }
    moveToScreen(window, window.screen().next());
    restore_mouse_position_for_window(window);
}));

// 移动窗口到下一个屏幕
keys.push(Phoenix.bind('h', hotKeyShift, function() {
    var window = Window.focusedWindow();
    if (!window) {
        return;
    }
    if (window.screen() === window.screen().next()) {
        return;
    }
    if (window.screen().next().frameInRectangle().x == 0) {
        return;
    }
    moveToScreen(window, window.screen().previous());
    restore_mouse_position_for_window(window);
}));

// 全屏幕
keys.push(Phoenix.bind('f', hotKeyShift, function() {
    var window = Window.focusedWindow();
    if (!window) {
        return;
    }
    if (!window.isFullScreen) {
        return window.setFullScreen(true);
    } else {
        return window.setFrame(600, 400, 20, 20);
    }
}));

// }}}

// vim: set ft=javascript sw=4:
