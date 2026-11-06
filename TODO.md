- [ ] Put instructions in a coach_readme.md - or somewhere student won't nessesarily look. coach (via rgg_server) should look here for worksheet instructions so it can guide students. 
coach view is the studnent's source of truth as to what to do next


 - [ ] Use something like this to ensure setup is complete:
 ```
 set up = 1, building, running tests (via test explorer), running rgg_server, adding partner's name to commit hook
 
 1. Make the build refuse to run until setup is done - add code other checks also
In CMakeLists.txt (or Makefile), check for a marker file that only the setup steps create:
cmake
if(NOT EXISTS "${CMAKE_SOURCE_DIR}/.coach/ready")
  message(FATAL_ERROR
    "\n*** Setup not complete ***\n"
    "Run ./setup.sh first (README step 1-4).\n"
    "It builds, runs the tests and starts the coach.\n")
endif()
```



- [ ]  Make it more obvious in the RRG what to do now - (smell list was distracting and they thought they should follow that)

- [ ] Strike through disabled buttons in coach
 
- [ ] if a new rgg_server.py is downloaded, do not commit it, do not have it in unstaged , student should not be able to commit by accident
