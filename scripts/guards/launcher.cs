// launcher.cs — the Windows front of scripts/guards/shim.mjs.
//
// An op worker's shell resolves `git` / `npm` to <runtime>/guards/bin/<tool>.exe
// (built from this file by scripts/guards/install.mjs with the .NET Framework
// csc.exe). A .cmd shim loses every argument after a newline and a .ps1 shim
// loses `--` to PowerShell's parameter binder; a native exe receives the raw
// command line exactly as git.exe would, and hands its tail to node unchanged.
//
// shim.cfg next to the exe: line 1 node.exe, line 2 shim.mjs.
// Fail-open: when node or the shim cannot start, the launcher runs the real
// <tool>.exe from PATH (skipping its own directory) with the same arguments.
using System;
using System.Diagnostics;
using System.IO;

class StarciGuardLauncher
{
    static int Main()
    {
        string exe = Process.GetCurrentProcess().MainModule.FileName;
        string dir = Path.GetDirectoryName(exe);
        string tool = Path.GetFileNameWithoutExtension(exe);
        string tail = ArgsTail(Environment.CommandLine);
        try
        {
            string[] cfg = File.ReadAllLines(Path.Combine(dir, "shim.cfg"));
            if (cfg.Length >= 2 && File.Exists(cfg[0]) && File.Exists(cfg[1]))
                return Run(cfg[0], "\"" + cfg[1] + "\" " + tool + (tail.Length > 0 ? " " + tail : ""));
        }
        catch (Exception e)
        {
            Console.Error.WriteLine("starci guard launcher: " + e.Message + "; running the real " + tool);
        }
        string real = RealTool(tool, dir);
        if (real == null) { Console.Error.WriteLine("starci guard launcher: no real " + tool + " on PATH"); return 127; }
        return Run(real, tail);
    }

    static int Run(string file, string args)
    {
        var psi = new ProcessStartInfo(file, args);
        psi.UseShellExecute = false;
        using (var p = Process.Start(psi))
        {
            p.WaitForExit();
            return p.ExitCode;
        }
    }

    static string RealTool(string tool, string self)
    {
        string path = Environment.GetEnvironmentVariable("PATH") ?? "";
        string me = Path.GetFullPath(self).TrimEnd('\\').ToLowerInvariant();
        foreach (string d in path.Split(';'))
        {
            if (d.Trim().Length == 0) continue;
            string full;
            try { full = Path.GetFullPath(d.Trim()).TrimEnd('\\').ToLowerInvariant(); } catch { continue; }
            if (full == me) continue;
            string candidate = Path.Combine(d.Trim(), tool + ".exe");
            if (File.Exists(candidate)) return candidate;
        }
        return null;
    }

    // The command line after argv[0], untouched (CommandLineToArgvW program-name rules).
    static string ArgsTail(string cmd)
    {
        cmd = cmd ?? "";
        int i = 0;
        if (cmd.Length > 0 && cmd[0] == '"')
        {
            int close = cmd.IndexOf('"', 1);
            i = close < 0 ? cmd.Length : close + 1;
        }
        else
        {
            while (i < cmd.Length && cmd[i] != ' ' && cmd[i] != '\t') i++;
        }
        while (i < cmd.Length && (cmd[i] == ' ' || cmd[i] == '\t')) i++;
        return cmd.Substring(i);
    }
}
