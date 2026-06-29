import AppKit
import SwiftUI

enum ExportTheme {
    static let moss = Color(red: 0x6B / 255.0, green: 0x9B / 255.0, blue: 0x7A / 255.0)
    static let brandGradient = LinearGradient(
        colors: [
            Color(red: 0x6B / 255.0, green: 0x9B / 255.0, blue: 0x7A / 255.0),
            Color(red: 0x5A / 255.0, green: 0x8A / 255.0, blue: 0x6E / 255.0),
            Color(red: 0x4A / 255.0, green: 0x75 / 255.0, blue: 0x60 / 255.0),
        ],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )
}

struct ExportFocusLogo: View {
    var size: CGFloat = 512

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: size * 0.28, style: .continuous)
                .fill(ExportTheme.brandGradient)
                .shadow(color: ExportTheme.moss.opacity(0.25), radius: size * 0.12, y: size * 0.06)

            Circle()
                .strokeBorder(Color.white.opacity(0.92), lineWidth: max(1.5, size * 0.04))
                .padding(size * 0.24)

            Circle()
                .strokeBorder(Color.white.opacity(0.45), lineWidth: max(1, size * 0.025))
                .padding(size * 0.34)

            Image(systemName: "leaf.fill")
                .font(.system(size: size * 0.32, weight: .medium))
                .foregroundStyle(.white.opacity(0.95))
                .rotationEffect(.degrees(-28))
                .offset(x: size * 0.06, y: -size * 0.02)
        }
        .frame(width: size, height: size)
    }
}

@MainActor
func exportPNG(size: Int, scale: CGFloat, output: URL) throws {
    let view = ExportFocusLogo(size: CGFloat(size))
    let renderer = ImageRenderer(content: view)
    renderer.scale = scale

    guard let cgImage = renderer.cgImage else {
        throw NSError(domain: "export", code: 1, userInfo: [NSLocalizedDescriptionKey: "Failed to render icon"])
    }

    let rep = NSBitmapImageRep(cgImage: cgImage)
    guard let data = rep.representation(using: .png, properties: [:]) else {
        throw NSError(domain: "export", code: 2, userInfo: [NSLocalizedDescriptionKey: "Failed to encode PNG"])
    }
    try data.write(to: output, options: .atomic)
}

let assetsDir = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)

Task { @MainActor in
    do {
        try exportPNG(size: 512, scale: 2, output: assetsDir.appendingPathComponent("focus-icon.png"))
        try exportPNG(size: 128, scale: 2, output: assetsDir.appendingPathComponent("focus-icon-128.png"))
        try exportPNG(size: 36, scale: 3, output: assetsDir.appendingPathComponent("focus-icon-36.png"))
        fputs("Exported Focus icons to \(assetsDir.path)\n", stderr)
        exit(0)
    } catch {
        fputs("Error: \(error.localizedDescription)\n", stderr)
        exit(1)
    }
}

RunLoop.main.run()
