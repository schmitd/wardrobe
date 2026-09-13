# Regression for the React Native 0.86.3 SPM UUID collision backport.
# No CocoaPods installation required; cloud Xcode compilation is the integration gate.
require_relative '../../../node_modules/react-native/scripts/cocoapods/spm'

class FakeProject
  attr_reader :objects_by_uuid
  def initialize
    @objects_by_uuid = { '0' => :root_project, '1' => :existing_target }
    @counter = -1
  end
  def generate_uuid
    @counter += 1
    @counter.to_s
  end
end

class FakeObject
  attr_reader :uuid, :initialized
  def initialize(project, uuid)
    @uuid = uuid
    project.objects_by_uuid[uuid] = self
  end
  def initialize_defaults
    @initialized = true
  end
end

project = FakeProject.new
manager = SPMManager.new
first = manager.send(:new_object, project, FakeObject)
second = manager.send(:new_object, project, FakeObject)
raise 'Root project overwritten' unless project.objects_by_uuid['0'] == :root_project
raise 'Target overwritten' unless project.objects_by_uuid['1'] == :existing_target
raise 'Collision not skipped' unless first.uuid == '2' && second.uuid == '3'
raise 'Defaults not initialized' unless first.initialized && second.initialized
puts 'SPM UUID regression passed: occupied IDs skipped, root preserved, objects initialized.'
