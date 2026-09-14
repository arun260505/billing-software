// InWallz Till — a tiny native window that hosts the till web app in WebView2.
//
// Why this exists: launched through Edge's --app mode, the taskbar/title icon was
// drawn (and cached) by Edge and came out blurry. As a real Windows program the
// icon is drawn by Windows straight from the embedded .ico — crisp, exactly like
// the installer's icon. It also drops the last browser chrome so it feels like a
// real POS app.
//
// Kept to C# 5 so it compiles with the in-box .NET Framework compiler (csc.exe),
// no SDK needed. References the WebView2 SDK DLLs in .\lib and needs the Evergreen
// WebView2 runtime (present on current Win10/11).
//
// Usage: InWallzTill.exe [url]   (defaults to http://localhost:5050/)

using System;
using System.Drawing;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace InWallzTill
{
    static class Program
    {
        static Mutex _mutex;

        [STAThread]
        static void Main(string[] args)
        {
            // Single instance: if the till is already open, just exit quietly.
            bool created;
            _mutex = new Mutex(true, "InWallzTill_SingleInstance", out created);
            if (!created) return;

            string url = (args != null && args.Length > 0 && !string.IsNullOrEmpty(args[0]))
                ? args[0]
                : "http://localhost:5050/";

            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new MainForm(url));
        }
    }

    public class MainForm : Form
    {
        [DllImport("user32.dll", CharSet = CharSet.Auto)]
        private static extern IntPtr SendMessage(IntPtr hWnd, int msg, IntPtr wParam, IntPtr lParam);
        private const int WM_SETICON = 0x0080;
        private const int ICON_SMALL = 0;
        private const int ICON_BIG = 1;

        private readonly string _url;
        private WebView2 _web;
        private Icon _small, _big;

        public MainForm(string url)
        {
            _url = url;
            Text = "InWallz Till";
            StartPosition = FormStartPosition.CenterScreen;
            Width = 1280;
            Height = 800;
            WindowState = FormWindowState.Maximized;

            // The window icon — pulled from the .ico's NATIVE frames so the small
            // title-bar icon (16px) and the taskbar icon (32px) are each crisp,
            // instead of one large frame scaled down (which looked blurry).
            try
            {
                string ico = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "app.ico");
                if (File.Exists(ico))
                {
                    _small = new Icon(ico, new Size(16, 16));
                    _big = new Icon(ico, new Size(32, 32));
                    Icon = _big;   // fallback for anything that reads Form.Icon
                }
            }
            catch { /* fall back to the embedded exe icon */ }

            _web = new WebView2();
            _web.Dock = DockStyle.Fill;
            Controls.Add(_web);

            Load += OnLoad;
        }

        protected override void OnHandleCreated(EventArgs e)
        {
            base.OnHandleCreated(e);
            // Give Windows the exact-size frames for the title bar and taskbar.
            try
            {
                if (_small != null) SendMessage(Handle, WM_SETICON, (IntPtr)ICON_SMALL, _small.Handle);
                if (_big != null) SendMessage(Handle, WM_SETICON, (IntPtr)ICON_BIG, _big.Handle);
            }
            catch { /* leave the default */ }
        }

        private async void OnLoad(object sender, EventArgs e)
        {
            try
            {
                // Keep the WebView's data (cache, logins) in the user's profile.
                string dataDir = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    "InWallzTill", "WebView2");
                Directory.CreateDirectory(dataDir);

                CoreWebView2Environment env = await CoreWebView2Environment.CreateAsync(null, dataDir, null);
                await _web.EnsureCoreWebView2Async(env);

                // A POS shell: no default context menu, no dev tools, no status bar.
                _web.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
                _web.CoreWebView2.Settings.AreDevToolsEnabled = false;
                _web.CoreWebView2.Settings.IsStatusBarEnabled = false;

                _web.CoreWebView2.Navigate(_url);
            }
            catch (Exception ex)
            {
                MessageBox.Show(
                    "Could not start the till view.\r\n\r\n" + ex.Message +
                    "\r\n\r\nIf this keeps happening, the WebView2 runtime may be missing.",
                    "InWallz Till", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }
    }
}
