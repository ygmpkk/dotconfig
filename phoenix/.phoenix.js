// TODO WorkSpace, 绑定快捷键，快速调出已经保存好布局的应用，支持多个Workspace间切换，将未在Workspace的应用隐藏起来
// TODO Layout，支持快速布局，9格的方式
// TODO Ignore apps
// TODO 保存上一次打开的应用

var keys = [];

var hotKey = ["alt"];
var hotKeyShift = ["alt", "shift"];
var hotKeyCtrl = ["alt", "ctrl"];
var hotKeyCmd = ["alt", "cmd"];
var _mousePositions = {};
var specificScreens = {
    main: '',
    second: '',
    third: ''
};

var recentApp = null;

// 自定义配置
Phoenix.set({
    daemon: true,
    openAtLogin: true
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
    var frame = Screen.main().frameInRectangle();
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
    var visibleAppMostRecentFirst = _.map(Window.recent(), function(w) {
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
    Mouse.move({
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
    Mouse.move(pos);
}

function restore_mouse_position_for_now() {
    if (Window.focused() === undefined) {
        return;
    }
    restore_mouse_position_for_window(Window.focused());
}
// }}}

// 运行应用
// {{{
function focusApplicationIfRunning(title) {
    // 启动App
    var focusApp = App.focused()
    var app = App.launch(title);
    assert(app !== undefined);
    if (app.isActive()) {
        app.hide();
        return app;
    }
    // app.show();
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

keys.push(new Key('1', hotKey, function() {
    focusApplicationIfRunning('iTerm');
}));
keys.push(new Key('2', hotKey, function() {
    focusApplicationIfRunning('MacVim');
}));
keys.push(new Key('3', hotKey, function() {
    focusApplicationIfRunning('Dash');
}));
keys.push(new Key('4', hotKey, function() {
    focusApplicationIfRunning('Atom');
}));

keys.push(new Key('q', hotKey, function() {
    focusApplicationIfRunning('Google Chrome');
}));
keys.push(new Key('w', hotKey, function() {
    focusApplicationIfRunning('有道词典');
}));
keys.push(new Key('e', hotKey, function() {
    focusApplicationIfRunning('NeteaseMusic');
}));
keys.push(new Key('r', hotKey, function() {
    focusApplicationIfRunning('AirMail 2');
}));
keys.push(new Key('t', hotKey, function() {
    focusApplicationIfRunning('Teambition');
}));

keys.push(new Key('a', hotKey, function() {
    focusApplicationIfRunning('钉钉');
}));
keys.push(new Key('s', hotKey, function() {
    focusApplicationIfRunning('Wechat');
}));
keys.push(new Key('d', hotKey, function() {
    focusApplicationIfRunning('QQ');
}));
keys.push(new Key('f', hotKey, function() {
    focusApplicationIfRunning('LeanChat');
}));
keys.push(new Key('g', hotKey, function() {
    focusApplicationIfRunning('BearyChat');
}));

keys.push(new Key('v', hotKey, function() {
    focusApplicationIfRunning('Calendar');
}));
// }}}

// 切换屏幕
// {{{
// 获取屏幕
function getScreenIndex(win) {
    var index = 0;
    var screen = win.screen();
    while (!!screen.previousScreen()) {
        index += 1;
        screen = screen.previousScreen();
    }
    return index;
}

function getLargeScreen(win) {
}

function getMacScreen(win) {
}

function fullScreen() {
    var win = Window.focused();
    message(win.isFullScreen());
    if (!win.isVisible() || win.isMinimized()) return;

    if (win.isFullScreen()) {
        win.setFullScreen(false);
    } else {
        win.setFullScreen(true);
    }
}

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
keys.push(new Key('l', hotKey, function() {
    var window = Window.focused();
    var allScreens = Screen.all();
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
keys.push(new Key('h', hotKey, function() {
    var window = Window.focused();
    var allScreens = Screen.all();
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
keys.push(new Key('l', hotKeyShift, function() {
    var window = Window.focused();
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
keys.push(new Key('h', hotKeyShift, function() {
    var window = Window.focused();
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
keys.push(new Key('f', hotKeyShift, function() {
    fullScreen();
}));

// }}}

// vim: set ft=javascript sw=4:
