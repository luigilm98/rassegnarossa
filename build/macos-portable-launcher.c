#include <limits.h>
#include <mach-o/dyld.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

static int trim_parent(char *path) {
  char *slash = strrchr(path, '/');
  if (!slash) {
    return -1;
  }
  *slash = '\0';
  return 0;
}

int main(void) {
  char executable[PATH_MAX];
  char resolved[PATH_MAX];
  uint32_t size = sizeof(executable);

  if (_NSGetExecutablePath(executable, &size) != 0) {
    return 1;
  }

  if (!realpath(executable, resolved)) {
    strncpy(resolved, executable, sizeof(resolved) - 1);
    resolved[sizeof(resolved) - 1] = '\0';
  }

  char package_root[PATH_MAX];
  strncpy(package_root, resolved, sizeof(package_root) - 1);
  package_root[sizeof(package_root) - 1] = '\0';

  // launcher -> MacOS -> Contents -> App bundle -> portable package.
  for (int depth = 0; depth < 4; depth += 1) {
    if (trim_parent(package_root) != 0) {
      return 1;
    }
  }

  char script[PATH_MAX];
  int written = snprintf(
      script,
      sizeof(script),
      "%s/launchers/start-macos.command",
      package_root);
  if (written <= 0 || written >= (int)sizeof(script)) {
    return 1;
  }

  execl("/bin/zsh", "zsh", script, (char *)NULL);
  return 1;
}
